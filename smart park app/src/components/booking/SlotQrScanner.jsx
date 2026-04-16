import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function SlotQrScanner({ onScanSuccess, onScanError }) {
  const containerIdRef = useRef(`slot-qr-scanner-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const onSuccessRef = useRef(onScanSuccess);
  const onErrorRef = useRef(onScanError);

  useEffect(() => {
    onSuccessRef.current = onScanSuccess;
    onErrorRef.current = onScanError;
  }, [onScanSuccess, onScanError]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      containerIdRef.current,
      {
        fps: 10,
        qrbox: { width: 240, height: 240 },
      },
      false
    );

    scannerRef.current = scanner;
    scanner.render(
      (decodedText) => onSuccessRef.current?.(decodedText),
      (err) => onErrorRef.current?.(err)
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);

  return <div id={containerIdRef.current} className="w-full" />;
}

