"""
ESKi KOD COKME TESTi
Amac: Gunicorn worker timeout'unu ve state sorunlarini gostermek.
"""
import requests
import time
import threading

BASE = "http://127.0.0.1:5099"
KEY = "your-secret-api-key"
HEADERS = {"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"}

# 30 satirlik agir veri
def make_rows(count=30):
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


def test_old_code():
    print("=" * 60)
    print("ESKI KOD - COKME TESTI (gunicorn timeout=3s, workers=2)")
    print("=" * 60)

    # TEST 1: Agir istek -> worker timeout
    print("\n[TEST 1] 30 satirlik PDF istegi (3s timeout'a takilmali)...")
    rows = make_rows(30)
    start = time.time()
    try:
        resp = requests.post(
            f"{BASE}/process-pdf", headers=HEADERS,
            json={"data": rows, "currency": "$"}, timeout=30
        )
        elapsed = time.time() - start
        if resp.status_code == 200:
            print(f"  SONUC: BASARILI (beklenmedik!) | {elapsed:.2f}s | {len(resp.content)} bytes")
        else:
            print(f"  SONUC: HATA {resp.status_code} | {elapsed:.2f}s")
            print(f"  Detay: {resp.text[:200]}")
    except requests.exceptions.ConnectionError:
        print(f"  SONUC: BAGLANTI KOPTU (worker oldu!) | {time.time()-start:.2f}s")
    except Exception as e:
        print(f"  SONUC: {type(e).__name__}: {e}")

    time.sleep(3)

    # TEST 2: Cokme sonrasi erisilebilirlik
    print("\n[TEST 2] Cokme sonrasi /api/isfree kontrolu...")
    try:
        resp = requests.get(
            f"{BASE}/api/isfree",
            headers={"Authorization": f"Bearer {KEY}"}, timeout=5
        )
        print(f"  SONUC: {resp.status_code} | {resp.text.strip()}")
        # is_processing hala True kalabilir (state sifirlanmadi)
        if "true" in resp.text.lower():
            print("  SORUN: is_processing hala True! State sifirlanmadi!")
    except Exception as e:
        print(f"  SONUC: ERISILEMEZ - {e}")

    time.sleep(2)

    # TEST 3: 2 worker mesgulken 3. istek
    print("\n[TEST 3] 2 eszamanli agir istek + progress kontrolu...")
    results = []

    def send_heavy(thread_id):
        start = time.time()
        try:
            resp = requests.post(
                f"{BASE}/process-pdf", headers=HEADERS,
                json={"data": make_rows(15), "currency": "$"}, timeout=30
            )
            results.append((thread_id, resp.status_code, time.time() - start, None))
        except requests.exceptions.ConnectionError:
            results.append((thread_id, 0, time.time() - start, "BAGLANTI KOPTU"))
        except Exception as e:
            results.append((thread_id, 0, time.time() - start, str(e)[:80]))

    t1 = threading.Thread(target=send_heavy, args=(1,))
    t2 = threading.Thread(target=send_heavy, args=(2,))
    t1.start()
    t2.start()

    # Her iki worker mesgulken progress dene
    time.sleep(1.5)
    print("  [3b] Tum workerlar mesgulken progress kontrolu...")
    try:
        resp = requests.get(
            f"{BASE}/api/progress",
            headers={"Authorization": f"Bearer {KEY}"}, timeout=3
        )
        print(f"       Progress: {resp.status_code} | {resp.text.strip()}")
    except requests.exceptions.ReadTimeout:
        print("       Progress: TIMEOUT! (tum workerlar mesgul, yanit yok)")
    except requests.exceptions.ConnectionError:
        print("       Progress: BAGLANTI KOPTU! (workerlar oldu)")
    except Exception as e:
        print(f"       Progress: HATA - {e}")

    t1.join(timeout=60)
    t2.join(timeout=60)

    for tid, status, elapsed, err in sorted(results):
        if err:
            print(f"  Thread {tid}: FAIL - {err} | {elapsed:.2f}s")
        else:
            print(f"  Thread {tid}: {status} | {elapsed:.2f}s")

    # TEST 4: Bellek sizintisi (ardarda istekler)
    print("\n[TEST 4] 8 ardarda istek - bellek sizintisi kontrolu...")
    import psutil, os
    pid = None
    for p in psutil.process_iter(['pid', 'cmdline']):
        try:
            cmd = " ".join(p.info['cmdline'] or [])
            if 'gunicorn' in cmd and '5099' in cmd and 'worker' not in cmd:
                pid = p.info['pid']
                break
        except:
            pass

    if pid:
        def get_mem():
            try:
                proc = psutil.Process(pid)
                total = proc.memory_info().rss
                for c in proc.children(recursive=True):
                    try:
                        total += c.memory_info().rss
                    except:
                        pass
                return total / (1024*1024)
            except:
                return 0

        mem_before = get_mem()
        success = 0
        fail = 0
        for i in range(8):
            try:
                resp = requests.post(
                    f"{BASE}/process-pdf", headers=HEADERS,
                    json={"data": make_rows(5), "currency": "$"}, timeout=15
                )
                if resp.status_code == 200:
                    success += 1
                else:
                    fail += 1
            except:
                fail += 1
            time.sleep(0.3)

        mem_after = get_mem()
        print(f"  Basarili: {success}/8 | Basarisiz: {fail}/8")
        print(f"  Bellek: {mem_before:.1f} MB -> {mem_after:.1f} MB (fark: {mem_after-mem_before:+.1f} MB)")
        if mem_after - mem_before > 30:
            print("  SORUN: Bellek sizintisi tespit edildi!")
    else:
        print("  PID bulunamadi, bellek testi atlanıyor")

    # TEST 5: Hata sonrasi state kontrolu
    print("\n[TEST 5] Bozuk istek -> state sifirlanma kontrolu...")
    try:
        resp = requests.post(
            f"{BASE}/process-pdf", headers=HEADERS,
            json={"data": "bozuk_veri"}, timeout=10
        )
        print(f"  Bozuk istek: {resp.status_code}")
    except:
        print("  Bozuk istek: baglanti hatasi")

    time.sleep(1)

    try:
        resp = requests.get(
            f"{BASE}/api/isfree",
            headers={"Authorization": f"Bearer {KEY}"}, timeout=5
        )
        data = resp.json()
        print(f"  is_free sonrasi: {data}")
        if data.get("is_processing"):
            print("  SORUN: Hata sonrasi is_processing=True kaldi! Yeni istek kabul edilmez!")
    except Exception as e:
        print(f"  Kontrol basarisiz: {e}")

    print("\n" + "=" * 60)
    print("ESKI KOD TESTI TAMAMLANDI")
    print("=" * 60)


if __name__ == "__main__":
    test_old_code()
