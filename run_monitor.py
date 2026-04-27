from app.drive_monitor import DriveMonitor

if __name__ == "__main__":
    monitor = DriveMonitor()
    monitor.process_new_files()