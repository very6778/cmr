"""
BELLEK SIZINTISI ve YAVAS BOZULMA TESTi
Sunucunun zamanla nasil coktugunun simulasyonu.
30 ardarda istek atip bellek buyumesini olcer.
"""
import requests
import time
import psutil
import json
import sys

BASE = "http://127.0.0.1:5099"
KEY = "your-secret-api-key"
HEADERS = {"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"}
REQUEST_COUNT = 30

def make_rows(count=5):
    rows = []
    for i in range(count):
        rows.append({
            "Menşei:": "TURKIYE",
            "Gönderen Adres / Exporter Adress": "ISTANBUL / TURKIYE",
            "GÖNDEREN / EXPORTER": f"TEST FIRMA {i+1} TARIM SANAYI VE TICARET LIMITED",
            "Alıcı Adresi / Consignee Adress": "BAGHDAD / IRAQ",
            "DATE:": "2026-01-15T00:00:00.000Z",
            "CMR NO:": str(1000 + i),
            "ALICI / CONSIGNEE": f"TEST ALICI {i+1} TRADING CO",
            "Yükleme Yeri / Place Of Loading": "MERSIN",
            "Gönderildiği Yer: ": "BAGHDAD / IRAQ",
            "ARAÇ PLAKA NO:": f"34AB{1000+i}",
            "Truck Plate NO": f"34CD{2000+i}",
            "Malın Cinsi:": "Bugday",
            "Brüt KG": str(25000 + i * 100),
            "DEĞER / VALUE": {"result": 7000.50 + i * 100},
            "Birim Fiyat": "$0.28",
            "Toplam Miktar": str(800 + i * 10),
            "Fatura No": f"INV2026{i+1:04d}",
            "ŞOFÖR ADI:": f"AHMET YILMAZ {i+1}",
            "Adet:": str(10 + i),
            "Ambalaj:": "CUVAL",
            "Marka ve No:": str(100000 + i),
        })
    return rows


def find_gunicorn_pid():
    for p in psutil.process_iter(["pid", "cmdline"]):
        try:
            cmd = " ".join(p.info["cmdline"] or [])
            if "5099" in cmd and ("gunicorn" in cmd or "app:app" in cmd):
                # Master process (first one found)
                return p.info["pid"]
        except:
            pass
    # Fallback: find by port
    for conn in psutil.net_connections(kind="tcp"):
        if conn.laddr.port == 5099 and conn.status == "LISTEN":
            return conn.pid
    return None


def get_total_memory(master_pid):
    try:
        proc = psutil.Process(master_pid)
        total = proc.memory_info().rss
        for c in proc.children(recursive=True):
            try:
                total += c.memory_info().rss
            except:
                pass
        return total / (1024 * 1024)
    except:
        return 0


def run_test(label):
    pid = find_gunicorn_pid()
    if not pid:
        print("HATA: Gunicorn bulunamadi!")
        return None

    print(f"\n{'=' * 60}")
    print(f"  BELLEK SIZINTISI TESTI - {label}")
    print(f"  {REQUEST_COUNT} ardarda istek, her biri 5 satirlik PDF")
    print(f"{'=' * 60}\n")

    mem_start = get_total_memory(pid)
    print(f"  Baslangic bellegi: {mem_start:.1f} MB\n")
    print(f"  {'#':>3}  {'Durum':>6}  {'Sure':>7}  {'Bellek':>10}  {'Fark':>8}")
    print(f"  {'-'*3}  {'-'*6}  {'-'*7}  {'-'*10}  {'-'*8}")

    results = []
    errors = 0

    for i in range(REQUEST_COUNT):
        start = time.time()
        try:
            resp = requests.post(
                f"{BASE}/process-pdf", headers=HEADERS,
                json={"data": make_rows(5), "currency": "$"}, timeout=30
            )
            elapsed = time.time() - start
            status = resp.status_code
            if status != 200:
                errors += 1
        except Exception as e:
            elapsed = time.time() - start
            status = 0
            errors += 1

        mem_now = get_total_memory(pid)
        diff = mem_now - mem_start
        results.append({"i": i+1, "status": status, "elapsed": elapsed, "mem": mem_now, "diff": diff})

        status_str = "OK" if status == 200 else f"ERR{status}"
        print(f"  {i+1:>3}  {status_str:>6}  {elapsed:>6.2f}s  {mem_now:>8.1f}MB  {diff:>+7.1f}MB")

        time.sleep(0.3)

    mem_end = get_total_memory(pid)
    total_leak = mem_end - mem_start

    print(f"\n  {'=' * 45}")
    print(f"  SONUC:")
    print(f"    Basarili:  {REQUEST_COUNT - errors}/{REQUEST_COUNT}")
    print(f"    Hatali:    {errors}/{REQUEST_COUNT}")
    print(f"    Bellek baslangic: {mem_start:.1f} MB")
    print(f"    Bellek bitis:     {mem_end:.1f} MB")
    print(f"    Toplam sizinti:   {total_leak:+.1f} MB")
    print(f"    Istek basina:     {total_leak/REQUEST_COUNT:+.1f} MB")

    if total_leak > 20:
        print(f"\n    *** BELLEK SIZINTISI VAR! ***")
        print(f"    30 istekte {total_leak:.0f}MB artti.")
        print(f"    Gunde 100 istek yapilsa: ~{total_leak/REQUEST_COUNT*100:.0f}MB/gun sizinti")
        print(f"    1GB limitli sunucuda ~{1024/(total_leak/REQUEST_COUNT*100):.0f} gunde cokme!")
    else:
        print(f"\n    Bellek stabil - sizinti yok.")

    print(f"  {'=' * 45}\n")

    return {
        "label": label,
        "mem_start": round(mem_start, 1),
        "mem_end": round(mem_end, 1),
        "leak_total": round(total_leak, 1),
        "leak_per_request": round(total_leak / REQUEST_COUNT, 1),
        "errors": errors,
        "success": REQUEST_COUNT - errors,
    }


if __name__ == "__main__":
    label = sys.argv[1] if len(sys.argv) > 1 else "TEST"
    output = sys.argv[2] if len(sys.argv) > 2 else None
    result = run_test(label)
    if result and output:
        with open(output, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Sonuclar: {output}")
