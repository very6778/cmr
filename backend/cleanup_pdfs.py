#!/usr/bin/env python3
"""
PDF Cleanup Script - Deletes all PDF files from outputs directory
Run this script daily via cron job to clean up old PDF files
"""

import os
import glob
from pathlib import Path

# Get the script's directory
SCRIPT_DIR = Path(__file__).parent
OUTPUTS_DIR = SCRIPT_DIR / "outputs"

def cleanup_pdfs():
    """Delete all PDF files from outputs directory"""
    try:
        # Find all PDF files
        pdf_files = glob.glob(str(OUTPUTS_DIR / "*.pdf"))
        
        deleted_count = 0
        for pdf_file in pdf_files:
            try:
                os.remove(pdf_file)
                deleted_count += 1
                print(f"Deleted: {pdf_file}")
            except Exception as e:
                print(f"Error deleting {pdf_file}: {e}")
        
        print(f"\nCleanup completed. Total files deleted: {deleted_count}")
        return deleted_count
        
    except Exception as e:
        print(f"Cleanup error: {e}")
        return 0

if __name__ == "__main__":
    print("Starting PDF cleanup...")
    cleanup_pdfs()
