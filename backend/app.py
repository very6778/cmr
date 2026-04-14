from flask import Flask, request, jsonify, send_file
import fitz
import textwrap
import io
import json
import multiprocessing as mp
from datetime import datetime
from dotenv import load_dotenv
import os
from flask_cors import CORS
from database import save_file_metadata
from cleanup_pdfs import start_background_cleanup
from jobs_store import get_store
import threading
import gc
import atexit
import time


def _shutdown_watchdog():
    """gthread worker kapanirken threading._shutdown() deadlock'a girebilir.
    Bu watchdog, kapanma 5 saniyeden uzun surerse os._exit() ile zorla cikar."""
    time.sleep(5)
    os._exit(0)


def _start_shutdown_watchdog():
    t = threading.Thread(target=_shutdown_watchdog, daemon=True)
    t.start()


atexit.register(_start_shutdown_watchdog)

load_dotenv()

# Font ve input.pdf buffer'larini modul yuklenirken bir kere oku.
# preload=True ile gunicorn fork oncesi yuklenir; multiprocessing fork COW
# sayesinde child process'ler de ek RAM tuketmeden paylasir.
_normal_font_buffer = open("./fonts/normal.ttf", "rb").read()
_bold_font_buffer = open("./fonts/bold.ttf", "rb").read()
_INPUT_PDF_BYTES = open("./input.pdf", "rb").read()

CORS_DOMAIN = os.getenv('CORS_DOMAIN', 'http://localhost:3000')
API_KEY = os.getenv('API_KEY', 'your-secret-api-key')
OUTPUT_DIR = "outputs"
MAX_BODY_BYTES = 50 * 1024 * 1024  # 50 MB
GC_EVERY_N_PAGES = 10

# Paralel PDF uretme kontrolleri (10x hizlanma icin)
PARALLEL_WORKERS = int(os.getenv("PARALLEL_WORKERS", str(min(8, (os.cpu_count() or 4)))))
PARALLEL_MIN_ROWS = int(os.getenv("PARALLEL_MIN_ROWS", "100"))

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

start_background_cleanup()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_BODY_BYTES
CORS(app, resources={r"/*": {"origins": "*"}})

key_map = {
    'Menşei:': 'ORIGIN_VAR',
    'Gönderen Adres / Exporter Adress': 'EXPORTER_ADDRESS_VAR',
    'Alıcı Adresi / Consignee Adress': 'PLACE_OF_DELIVERY_VAR',
    'DATE:': 'DATE_VAR',
    'CMR NO:': 'CMR_NO_VAR',
    'ALICI / CONSIGNEE': 'CONSIGNEE_VAR',
    'Yükleme Yeri / Place Of Loading': 'PLACE_DATE_OF_LOADING_VAR',
    'Gönderildiği Yer: ': 'PLACE_OF_DELIVERY_VAR',
    'ARAÇ PLAKA NO:': 'CAR_PLATE_VAR',
    'Truck Plate NO': 'TRUCK_PLATE_VAR',
    'Malın Cinsi:': 'DESCRIPTION_VAR',
    'Brüt KG': 'GROSS_WEIGHT_VAR',
    'DEĞER / VALUE': 'VALUE_VAR',
    'Birim Fiyat': 'UNIT_PRICE_VAR',
    'Toplam Miktar': 'TOTAL_QUANTITY_VAR',
    'Fatura No': 'INVOICE_NO_VAR',
    'ŞOFÖR ADI:': 'DRIVER_VAR',
    'Adet:': 'QUANTITY_VAR',
    'Ambalaj:': 'PACKING_VAR',
    'Marka ve No:': 'MARK_NO_VAR',
    'GÖNDEREN / EXPORTER': 'EXPORTER_VAR',
}


def save_to_local_storage(file_bytes, filename):
    try:
        file_path = os.path.join(OUTPUT_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        return True
    except Exception as e:
        print(f"File Save Error: {e}")
        return False


def format_date(date_string):
    try:
        date_obj = datetime.strptime(date_string, "%Y-%m-%dT%H:%M:%S.%fZ")
        return date_obj.strftime("%d/%m/%Y")
    except ValueError:
        return date_string


def edit_pdf(replacements: dict, page_index: int = 0):
    """Input.pdf'i replacements ile doldurur ve BytesIO doner.

    Optimizasyonlar (eski koda gore):
    - insert_font sayfada 2 kez cagrilir (ornek eskiden 40 kez)
    - add_redact_annot topluca eklenir, apply_redactions 1 kez cagrilir (eskiden 20 kez)
    - search_for sonucunun sadece ilk elemanini kullaniriz (ilk match'te break)
    """
    pdf_document = fitz.open(stream=_INPUT_PDF_BYTES, filetype="pdf")
    try:
        for page_number in range(pdf_document.page_count):
            page = pdf_document[page_number]

            # Onceden her replacement icin area + insert_text bilgilerini topla.
            # Redact annot'lari bu turda eklenir; apply_redactions tek seferde sonunda.
            insert_ops = []
            for text_to_replace, replacement_info in replacements.items():
                areas = page.search_for(text_to_replace)
                if not areas:
                    continue
                area = areas[0]
                x0, y0, x1, y1 = area
                boxArea = (x0, y0 + 2, x1, y1 - 2)
                page.add_redact_annot(boxArea, fill=(1, 1, 1))
                y_off = y0 + 10.5 if y0 >= 0 else y0 - 8.1
                insert_ops.append((x0, y_off, replacement_info))

            # Apply + font register SIRASI ONEMLI:
            # apply_redactions() content stream'i yeniden uretir -> onceden
            # kaydedilmis fontlar silinir. Bu yuzden once apply, sonra insert_font.
            if insert_ops:
                page.apply_redactions()
                page.insert_font(fontname="normal", fontbuffer=_normal_font_buffer)
                page.insert_font(fontname="bold", fontbuffer=_bold_font_buffer)

            # Text insert'leri redact + font register'dan sonra yap
            for x0, y_off, info in insert_ops:
                text = info["text"]
                fontname = info.get("fontname", "normal")
                fontsize = info.get("fontsize", 12)
                wrap = info.get("wrap", False)
                wrap_width = info.get("wrap_width", 25)
                if wrap:
                    wrapped_text = textwrap.fill(text, width=wrap_width, break_long_words=False)
                    for i, line in enumerate(wrapped_text.split('\n')):
                        y_line = y_off + (i * (fontsize + 2))
                        page.insert_text((x0, y_line), line, fontname=fontname, fontsize=fontsize, color=(0, 0, 0))
                else:
                    page.insert_text((x0, y_off), text, fontname=fontname, fontsize=fontsize, color=(0, 0, 0))

        pdf_bytes = pdf_document.write()
        return io.BytesIO(pdf_bytes)
    finally:
        pdf_document.close()
        if page_index and (page_index % GC_EVERY_N_PAGES == 0):
            try:
                fitz.TOOLS.store_shrink(100)
            except Exception:
                pass
            gc.collect()


def _build_replacements(entry: dict, currency: str) -> dict:
    """Bir CMR satirini input.pdf'teki hedef metinlere esler."""
    return {
        "RUSYA": {"text": entry.get("ORIGIN_VAR", "N/A"), "fontname": "bold", "fontsize": 12, "wrap": True, "wrap_width": 25},
        "MARDIN / TURKIYE": {"text": entry.get("EXPORTER_ADDRESS_VAR", "N/A"), "fontname": "normal", "fontsize": 12, "wrap": True, "wrap_width": 25},
        "ERTAŞ GRUP TARIM SANAYİ VE TİCARET LİMİTED": {"text": entry.get("EXPORTER_VAR", "N/A"), "fontname": "normal", "fontsize": 11, "wrap": True, "wrap_width": 42},
        "İSKENDERUN": {"text": entry.get("PLACE_DATE_OF_LOADING_VAR", "N/A"), "fontname": "normal", "fontsize": 11},
        "SULEYMANIYAH / IRAK": {"text": entry.get("PLACE_OF_DELIVERY_VAR", "N/A"), "fontname": "normal", "fontsize": 12},
        "MEHMET MEHMET": {"text": entry.get("DRIVER_VAR", "N/A"), "fontname": "normal", "fontsize": 12, "wrap": True, "wrap_width": 25},
        "34KA4273": {"text": entry.get("CAR_PLATE_VAR", "N/A"), "fontname": "normal", "fontsize": 12},
        "73AAD890": {"text": entry.get("TRUCK_PLATE_VAR", "N/A"), "fontname": "normal", "fontsize": 12},
        "19.12.2024": {"text": format_date(entry.get("DATE_VAR", "N/A")), "fontname": "normal", "fontsize": 12},
        "122": {"text": entry.get("CMR_NO_VAR", "N/A"), "fontname": "normal", "fontsize": 12},
        "KAP": {"text": entry.get("PACKING_VAR", "N/A"), "fontname": "bold", "fontsize": 12, "wrap": True, "wrap_width": 6},
        "Ekmeklik Buğday": {"text": entry.get("DESCRIPTION_VAR", "N/A"), "fontname": "bold", "fontsize": 12, "wrap": True, "wrap_width": 25},
        "26660": {"text": entry.get("GROSS_WEIGHT_VAR", "N/A"), "fontname": "bold", "fontsize": 12},
        "100199": {"text": entry.get("MARK_NO_VAR", "N/A"), "fontname": "bold", "fontsize": 12},
        "$0,262862": {"text": entry.get("UNIT_PRICE_VAR", "N/A"), "fontname": "bold", "fontsize": 11},
        "$7.007,91": {"text": f"{entry.get('VALUE_VAR', 'N/A')} {currency}", "fontname": "normal", "fontsize": 12},
        "810,08": {"text": entry.get("TOTAL_QUANTITY_VAR", "N/A"), "fontname": "bold", "fontsize": 11},
        "GIB2024000000057": {"text": entry.get("INVOICE_NO_VAR", "N/A"), "fontname": "bold", "fontsize": 10},
        "QAIWAN FOR FOODSTUFFS MANUFACTURING": {"text": entry.get("CONSIGNEE_VAR", "N/A"), "fontname": "normal", "fontsize": 11, "wrap": True, "wrap_width": 35},
        "13": {"text": entry.get("QUANTITY_VAR", "N/A"), "fontname": "bold", "fontsize": 12, "wrap": True, "wrap_width": 25},
    }


def _render_row(arg):
    """multiprocessing.Pool icinde child process'te calisir. Module-level
    olmali ki pickle edilebilsin. fork COW ile _INPUT_PDF_BYTES + font buffer'lari
    parent'tan miras alir."""
    entry, currency, idx = arg
    replacements = _build_replacements(entry, currency)
    bio = edit_pdf(replacements, page_index=idx)
    return bio.getvalue()


def merge_pdfs(pdf_list):
    merged_pdf = fitz.open()
    try:
        for pdf in pdf_list:
            pdf.seek(0)
            src = fitz.open(stream=pdf.read(), filetype="pdf")
            try:
                merged_pdf.insert_pdf(src)
            finally:
                src.close()

        merged_pdf_bytes = io.BytesIO()
        # Sikistirma + duplicate font/object temizligi.
        # 182 sayfalik CMR icin ~188MB -> ~15-25MB'e dusurur.
        #   deflate=True         : tum stream'leri zlib ile sikistir
        #   deflate_images=True  : image stream'lerini sikistir
        #   deflate_fonts=True   : font stream'lerini sikistir
        #   garbage=4            : unreferenced object'leri temizle (duplicate fontlar)
        #   use_objstms=1        : object stream'ler (daha kompakt xref)
        merged_pdf.save(
            merged_pdf_bytes,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            garbage=4,
            clean=True,
            use_objstms=1,
        )
        merged_pdf_bytes.seek(0)
        return merged_pdf_bytes
    finally:
        merged_pdf.close()
        for pdf in pdf_list:
            try:
                pdf.close()
            except Exception:
                pass


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200


@app.route('/process-pdf', methods=['POST', 'OPTIONS'])
def api_process_pdf():
    if request.method == 'OPTIONS':
        return '', 200

    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        return jsonify({"error": "Unauthorized"}), 401

    pages = []
    job_id = None
    store = get_store()
    T = {"start": time.time()}
    try:
        data = request.get_json()
        body_data = data.get('data', [])
        currency = data.get('currency', '$')

        if not isinstance(body_data, list):
            return jsonify({'error': 'Expected an array of items.'}), 400

        job_id = store.new_job(total=len(body_data) + 1)

        transformed_data = []
        for item in body_data:
            transformed_item = {}
            for key, value in item.items():
                new_key = key_map.get(key)
                if new_key:
                    if isinstance(value, dict) and 'result' in value:
                        transformed_item[new_key] = f"{value['result']:.2f}"
                    else:
                        transformed_item[new_key] = str(value)
            transformed_data.append(transformed_item)

        n = len(transformed_data)
        use_parallel = PARALLEL_WORKERS > 1 and n >= PARALLEL_MIN_ROWS

        if use_parallel:
            # Fork context: parent'in _INPUT_PDF_BYTES/font buffer'larini COW ile paylas.
            # Redis client child'da kullanilmaz; child sadece PDF bytes uretir.
            ctx = mp.get_context("fork")
            args = [(entry, currency, idx) for idx, entry in enumerate(transformed_data, start=1)]
            chunksize = max(1, n // (PARALLEL_WORKERS * 4))
            with ctx.Pool(processes=PARALLEL_WORKERS) as pool:
                for idx, pdf_bytes in enumerate(pool.imap(_render_row, args, chunksize=chunksize), start=1):
                    pages.append(io.BytesIO(pdf_bytes))
                    # Progress her N (=max(1, n/100)) satirda bir guncelle (Redis'i boguma).
                    if idx == n or idx % max(1, n // 100) == 0:
                        store.update(job_id, idx)
        else:
            for idx, entry in enumerate(transformed_data, start=1):
                replacements = _build_replacements(entry, currency)
                edited_pdf = edit_pdf(replacements, page_index=idx)
                pages.append(edited_pdf)
                store.update(job_id, idx)

        merged_pdf = merge_pdfs(pages)
        store.update(job_id, n + 1)

        current_time = datetime.now().isoformat().replace(':', '-')
        file_name = f"out_{current_time}.pdf"

        merged_pdf_bytes = merged_pdf.getvalue()
        save_to_local_storage(merged_pdf_bytes, file_name)
        save_file_metadata(file_name, json.dumps(transformed_data, default=str))

        response_pdf = io.BytesIO(merged_pdf_bytes)
        response = send_file(response_pdf, as_attachment=True, download_name=file_name, mimetype="application/pdf")
        # Timing bilgisini response header'a koy (UI debug + prod telemetri).
        size_mb = len(merged_pdf_bytes) / 1024 / 1024
        total = time.time() - T["start"]
        response.headers["X-Processing-Time"] = f"{total:.2f}"
        response.headers["X-PDF-Size-MB"] = f"{size_mb:.1f}"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0"
        response.headers["X-Job-Id"] = job_id
        return response
    except Exception as e:
        print(f"PDF Processing Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        for p in pages:
            try:
                p.close()
            except Exception:
                pass
        pages.clear()
        if job_id is not None:
            try:
                store.finish(job_id)
            except Exception:
                pass
        try:
            fitz.TOOLS.store_shrink(100)
        except Exception:
            pass
        gc.collect()


@app.route('/api/progress', methods=['GET', 'OPTIONS'])
def get_progress():
    if request.method == 'OPTIONS':
        return '', 200
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        return jsonify({"error": "Unauthorized"}), 401

    store = get_store()
    job_id = request.args.get("job_id")
    if job_id:
        j = store.get(job_id)
        if not j:
            return jsonify({"current": 0, "total": 0, "unknown": True})
        return jsonify({"current": j["current"], "total": j["total"], "finished": j.get("finished", False)})

    rep = store.representative()
    if not rep:
        return jsonify({"current": 0, "total": 0})
    _, j = rep
    return jsonify({"current": j["current"], "total": j["total"]})


@app.route('/api/isfree', methods=['GET', 'OPTIONS'])
def get_isfree():
    if request.method == 'OPTIONS':
        return '', 200
    auth_header = request.headers.get("Authorization")
    if auth_header != f"Bearer {API_KEY}":
        return jsonify({"error": "Unauthorized"}), 401

    store = get_store()
    processing = store.any_active()
    if processing:
        return jsonify({"is_processing": processing}), 429
    else:
        return jsonify({"is_processing": processing}), 200


if __name__ == '__main__':
    app.run(port=5001)
