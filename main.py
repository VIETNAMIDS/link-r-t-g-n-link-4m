import os
import sys
import time
import ctypes
import threading
from flask import Flask, jsonify, request, send_from_directory
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# Khởi tạo Flask App
app = Flask(__name__, static_folder='.')

driver = None
driver_lock = threading.Lock()
status_state = {
    "connected": False,
    "current_url": "about:blank",
    "title": "",
    "logs": []
}

def log(msg):
    timestamp = time.strftime("%H:%M:%S")
    entry = f"[{timestamp}] {msg}"
    print(entry)
    status_state["logs"].append(entry)
    if len(status_state["logs"]) > 100:
        status_state["logs"].pop(0)

def get_screen_size():
    try:
        user32 = ctypes.windll.user32
        return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    except Exception:
        return 1920, 1080

def init_driver(incognito=False):
    global driver
    with driver_lock:
        if driver is not None:
            return driver

        log("Đang khởi tạo ChromeDriver...")
        chrome_options = Options()
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        if incognito:
            chrome_options.add_argument("--incognito")

        # Khởi tạo Selenium ChromeDriver (Selenium 4+ tự động quản lý driver)
        driver = webdriver.Chrome(options=chrome_options)
        
        # Định vị cửa sổ ChromeDriver nằm gọn ở 75% màn hình bên trái
        screen_w, screen_h = get_screen_size()
        panel_w = 420
        driver_w = max(800, screen_w - panel_w)
        driver.set_window_rect(x=0, y=0, width=driver_w, height=screen_h)

        status_state["connected"] = True
        log("ChromeDriver đã khởi động và định vị thành công.")
        return driver

def close_driver():
    global driver
    with driver_lock:
        if driver:
            log("Đang đóng ChromeDriver...")
            try:
                driver.quit()
            except Exception as e:
                log(f"Lỗi khi đóng driver: {e}")
            finally:
                driver = None
                status_state["connected"] = False
                status_state["current_url"] = "about:blank"
                status_state["title"] = ""
                log("ChromeDriver đã đóng.")

# ================= Các Tuyến API =================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/status', methods=['GET'])
def get_status():
    global driver
    if driver:
        try:
            status_state["current_url"] = driver.current_url
            status_state["title"] = driver.title
        except Exception:
            pass
    return jsonify(status_state)

@app.route('/api/start', methods=['POST'])
def start_session():
    data = request.json or {}
    target_url = data.get('url', '').strip()
    incognito = data.get('incognito', False)

    if not target_url:
        return jsonify({"success": False, "error": "Thiếu URL mục tiêu"}), 400

    def run_navigation():
        try:
            d = init_driver(incognito)
            log(f"Đang mở trang: {target_url}")
            d.get(target_url)
            log(f"Đã tải xong: {d.title}")
        except Exception as e:
            log(f"Lỗi điều hướng: {e}")

    threading.Thread(target=run_navigation, daemon=True).start()
    return jsonify({"success": True, "message": "Đã bắt đầu phiên điều khiển."})

@app.route('/api/stop', methods=['POST'])
def stop_session():
    threading.Thread(target=close_driver, daemon=True).start()
    return jsonify({"success": True, "message": "Đang dừng ChromeDriver."})

@app.route('/api/navigate', methods=['POST'])
def navigate_action():
    global driver
    data = request.json or {}
    action = data.get('action')

    if not driver:
        return jsonify({"success": False, "error": "Driver chưa chạy"}), 400

    try:
        if action == "back":
            driver.back()
        elif action == "forward":
            driver.forward()
        elif action == "refresh":
            driver.refresh()
        log(f"Thực hiện thao tác điều hướng: {action}")
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    log("Khởi động Web Controller Server tại http://127.0.0.1:5000 ...")
    app.run(host='127.0.0.1', port=5000, debug=False)
