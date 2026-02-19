"""
CMR Backend Stress Test
-----------------------
Eski vs Yeni kod karsilastirmasi icin benchmark scripti.

Olctukleri:
- Yanit suresi (avg, min, max)
- Hata orani
- Bellek kullanimi (RSS)
- Worker timeout sayisi
- Progress endpoint erisilebilirligi (PDF islenirken)
"""

import requests
import time
import json
import threading
import statistics
import os
import signal
import subprocess
import sys
import psutil

# ============ AYARLAR ============
BASE_URL = "http://127.0.0.1:5099"
API_KEY = "your-secret-api-key"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
}

# Test verisi - 10 satir CMR
def make_test_data(row_count=10):
    rows = []
    for i in range(row_count):
        rows.append({
            "Menşei:": f"TURKIYE",
            "Gönderen Adres / Exporter Adress": f"ISTANBUL / TURKIYE",
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
            "Birim Fiyat": f"$0.28",
            "Toplam Miktar": str(800 + i * 10),
            "Fatura No": f"INV2026{i+1:04d}",
            "ŞOFÖR ADI:": f"AHMET YILMAZ {i+1}",
            "Adet:": str(10 + i),
            "Ambalaj:": "CUVAL",
            "Marka ve No:": str(100000 + i),
        })
    return {"data": rows, "currency": "$"}


def get_process_memory(pid):
    """PID'nin bellek kullanimini MB olarak dondurur."""
    try:
        proc = psutil.Process(pid)
        children = proc.children(recursive=True)
        total = proc.memory_info().rss
        for child in children:
            try:
                total += child.memory_info().rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return total / (1024 * 1024)  # MB
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return 0


# ============ TEST FONKSIYONLARI ============

def test_single_request(row_count=5):
    """Tek bir PDF istegi gonder, sure ve sonucu olc."""
    data = make_test_data(row_count)
    start = time.time()
    try:
        resp = requests.post(
            f"{BASE_URL}/process-pdf",
            headers=HEADERS,
            json=data,
            timeout=120,
        )
        elapsed = time.time() - start
        return {
            "status": resp.status_code,
            "elapsed": elapsed,
            "size": len(resp.content),
            "error": None if resp.status_code == 200 else resp.text[:200],
        }
    except requests.exceptions.Timeout:
        return {"status": 0, "elapsed": time.time() - start, "size": 0, "error": "TIMEOUT"}
    except requests.exceptions.ConnectionError as e:
        return {"status": 0, "elapsed": time.time() - start, "size": 0, "error": f"CONNECTION_ERROR: {str(e)[:100]}"}
    except Exception as e:
        return {"status": 0, "elapsed": time.time() - start, "size": 0, "error": str(e)[:200]}


def test_progress_during_processing():
    """PDF islenirken /api/progress endpointine erisilebiliyor mu?"""
    results = {"pdf_result": None, "progress_checks": [], "progress_errors": 0}

    def process_pdf():
        results["pdf_result"] = test_single_request(row_count=8)

    def check_progress():
        while pdf_thread.is_alive():
            try:
                start = time.time()
                resp = requests.get(
                    f"{BASE_URL}/api/progress",
                    headers={"Authorization": f"Bearer {API_KEY}"},
                    timeout=5,
                )
                elapsed = time.time() - start
                results["progress_checks"].append({
                    "status": resp.status_code,
                    "elapsed": elapsed,
                })
            except Exception as e:
                results["progress_errors"] += 1
            time.sleep(0.5)

    pdf_thread = threading.Thread(target=process_pdf)
    progress_thread = threading.Thread(target=check_progress)

    pdf_thread.start()
    progress_thread.start()
    pdf_thread.join(timeout=120)
    progress_thread.join(timeout=5)

    return results


def test_concurrent_requests(concurrency=3, row_count=5):
    """Ayni anda birden fazla PDF istegi gonder."""
    results = []
    threads = []

    def worker():
        r = test_single_request(row_count)
        results.append(r)

    for _ in range(concurrency):
        t = threading.Thread(target=worker)
        threads.append(t)

    start = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=180)
    total_time = time.time() - start

    return {"total_time": total_time, "results": results}


def test_error_recovery():
    """Bozuk istek sonrasi normal istek calisir mi?"""
    # 1. Bozuk veri gonder
    bad_resp = None
    try:
        resp = requests.post(
            f"{BASE_URL}/process-pdf",
            headers=HEADERS,
            json={"data": "not_a_list"},
            timeout=30,
        )
        bad_resp = {"status": resp.status_code}
    except Exception as e:
        bad_resp = {"status": 0, "error": str(e)[:100]}

    time.sleep(1)

    # 2. Normal istek gonder
    good_resp = test_single_request(row_count=2)

    # 3. is_processing durumu kontrol
    try:
        free_resp = requests.get(
            f"{BASE_URL}/api/isfree",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=5,
        )
        is_free = free_resp.json() if free_resp.status_code == 200 else {"error": free_resp.status_code}
    except Exception as e:
        is_free = {"error": str(e)[:100]}

    return {
        "bad_request": bad_resp,
        "recovery_request": good_resp,
        "is_free_after": is_free,
    }


def test_repeated_requests(count=5):
    """Ardarda istek gonderip bellek sizintisi kontrol."""
    results = []
    for i in range(count):
        r = test_single_request(row_count=3)
        results.append(r)
        time.sleep(0.5)
    return results


# ============ ANA TEST CALISTIRICISI ============

def run_all_tests(gunicorn_pid):
    print("\n" + "=" * 60)
    print("CMR BACKEND STRESS TEST")
    print("=" * 60)

    report = {}

    # Baslangic bellegi
    mem_start = get_process_memory(gunicorn_pid)
    report["memory_start_mb"] = round(mem_start, 1)
    print(f"\n[BELLEK] Baslangic: {mem_start:.1f} MB")

    # Test 1: Tek istek
    print("\n--- TEST 1: Tek PDF Istegi (5 satir) ---")
    r1 = test_single_request(5)
    report["single_request"] = r1
    print(f"  Durum: {r1['status']} | Sure: {r1['elapsed']:.2f}s | Boyut: {r1['size']} bytes")
    if r1["error"]:
        print(f"  HATA: {r1['error']}")

    # Test 2: Progress erisilebilirligi
    print("\n--- TEST 2: PDF Islenirken Progress Kontrolu ---")
    r2 = test_progress_during_processing()
    pdf_ok = r2["pdf_result"]["status"] == 200 if r2["pdf_result"] else False
    prog_count = len(r2["progress_checks"])
    prog_ok = sum(1 for p in r2["progress_checks"] if p["status"] == 200)
    report["progress_test"] = {
        "pdf_ok": pdf_ok,
        "progress_total": prog_count,
        "progress_ok": prog_ok,
        "progress_errors": r2["progress_errors"],
    }
    print(f"  PDF: {'OK' if pdf_ok else 'FAIL'} | Progress: {prog_ok}/{prog_count} basarili | Hata: {r2['progress_errors']}")

    # Test 3: Eszamanli istekler
    print("\n--- TEST 3: 3 Eszamanli PDF Istegi ---")
    r3 = test_concurrent_requests(3, 5)
    ok_count = sum(1 for r in r3["results"] if r["status"] == 200)
    err_count = sum(1 for r in r3["results"] if r["status"] != 200)
    times = [r["elapsed"] for r in r3["results"]]
    report["concurrent"] = {
        "total_time": round(r3["total_time"], 2),
        "success": ok_count,
        "errors": err_count,
        "avg_time": round(statistics.mean(times), 2) if times else 0,
        "max_time": round(max(times), 2) if times else 0,
        "error_details": [r["error"] for r in r3["results"] if r["error"]],
    }
    print(f"  Toplam: {r3['total_time']:.2f}s | Basarili: {ok_count}/3 | Hata: {err_count}")
    if times:
        print(f"  Yanit suresi: avg={statistics.mean(times):.2f}s max={max(times):.2f}s")
    for r in r3["results"]:
        if r["error"]:
            print(f"  HATA: {r['error'][:100]}")

    # Test 4: Hata sonrasi toparlanma
    print("\n--- TEST 4: Hata Sonrasi Toparlanma ---")
    r4 = test_error_recovery()
    recovery_ok = r4["recovery_request"]["status"] == 200
    report["error_recovery"] = {
        "bad_request_status": r4["bad_request"]["status"] if r4["bad_request"] else 0,
        "recovery_ok": recovery_ok,
        "is_free": r4["is_free_after"],
    }
    print(f"  Bozuk istek: {r4['bad_request']}")
    print(f"  Toparlanma: {'OK' if recovery_ok else 'FAIL'} (status: {r4['recovery_request']['status']})")
    print(f"  is_free: {r4['is_free_after']}")

    # Test 5: Ardarda istekler (bellek sizintisi)
    print("\n--- TEST 5: 5 Ardarda Istek (Bellek Sizintisi) ---")
    r5 = test_repeated_requests(5)
    ok5 = sum(1 for r in r5 if r["status"] == 200)
    times5 = [r["elapsed"] for r in r5]
    report["repeated"] = {
        "success": ok5,
        "total": 5,
        "avg_time": round(statistics.mean(times5), 2) if times5 else 0,
        "errors": [r["error"] for r in r5 if r["error"]],
    }
    print(f"  Basarili: {ok5}/5 | Avg sure: {statistics.mean(times5):.2f}s")

    # Bitis bellegi
    mem_end = get_process_memory(gunicorn_pid)
    report["memory_end_mb"] = round(mem_end, 1)
    report["memory_diff_mb"] = round(mem_end - mem_start, 1)
    print(f"\n[BELLEK] Bitis: {mem_end:.1f} MB | Fark: {mem_end - mem_start:+.1f} MB")

    print("\n" + "=" * 60)
    print("TEST TAMAMLANDI")
    print("=" * 60)

    return report


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pid", type=int, required=True, help="Gunicorn master PID")
    parser.add_argument("--label", default="test", help="Test etiketi (old/new)")
    parser.add_argument("--output", default=None, help="JSON cikti dosyasi")
    args = parser.parse_args()

    report = run_all_tests(args.pid)
    report["label"] = args.label
    report["timestamp"] = time.strftime("%Y-%m-%d %H:%M:%S")

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nSonuclar kaydedildi: {args.output}")
