import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, ZoomIn, ZoomOut, Check, ImageIcon } from 'lucide-react';
import * as api from '@/lib/api';

interface ImageUploaderProps {
  aspectRatio: number;
  currentUrl: string;
  folder: string;
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}

export function ImageUploader({
  aspectRatio,
  currentUrl,
  folder,
  onUploaded,
  label = 'Upload picture',
  className = '',
}: ImageUploaderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Image must be under 15 MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const image = new Image();
      image.onload = () => {
        setImgEl(image);
        setImgSrc(src);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setModalOpen(true);
      };
      image.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getBaseScale = useCallback(() => {
    if (!imgEl || !frameRef.current) return 1;
    const fw = frameRef.current.clientWidth;
    const fh = frameRef.current.clientHeight;
    return Math.min(fw / imgEl.naturalWidth, fh / imgEl.naturalHeight);
  }, [imgEl]);

  const clampOffset = useCallback((x: number, y: number, z: number) => {
    if (!imgEl || !frameRef.current) return { x, y };
    const fw = frameRef.current.clientWidth;
    const fh = frameRef.current.clientHeight;
    const base = Math.min(fw / imgEl.naturalWidth, fh / imgEl.naturalHeight);
    const dispW = imgEl.naturalWidth * base * z;
    const dispH = imgEl.naturalHeight * base * z;
    let cx = x, cy = y;
    if (dispW >= fw) { cx = Math.min(0, Math.max(fw - dispW, x)); } else { cx = (fw - dispW) / 2; }
    if (dispH >= fh) { cy = Math.min(0, Math.max(fh - dispH, y)); } else { cy = (fh - dispH) / 2; }
    return { x: cx, y: cy };
  }, [imgEl]);

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgEl) return;
    const point = 'touches' in e ? e.touches[0] : e;
    dragRef.current = { startX: point.clientX, startY: point.clientY, baseX: offset.x, baseY: offset.y };
  };

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current || !imgEl) return;
    const point = 'touches' in e ? e.touches[0] : e;
    const dx = point.clientX - dragRef.current.startX;
    const dy = point.clientY - dragRef.current.startY;
    const clamped = clampOffset(dragRef.current.baseX + dx, dragRef.current.baseY + dy, zoom);
    setOffset(clamped);
  };

  const onMouseUp = () => { dragRef.current = null; };

  useEffect(() => {
    if (!modalOpen) return;
    const move = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const point = 'touches' in e ? e.touches[0] : e;
      const dx = point.clientX - dragRef.current.startX;
      const dy = point.clientY - dragRef.current.startY;
      const clamped = clampOffset(dragRef.current.baseX + dx, dragRef.current.baseY + dy, zoom);
      setOffset(clamped);
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [modalOpen, zoom, clampOffset]);

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(1, Math.min(4, zoom + delta));
    setZoom(newZoom);
    setOffset((o) => clampOffset(o.x, o.y, newZoom));
  };

  const confirmCrop = async () => {
    if (!imgEl || !frameRef.current) return;
    setUploading(true);
    setError('');
    try {
      const fw = frameRef.current.clientWidth;
      const fh = frameRef.current.clientHeight;
      const base = Math.min(fw / imgEl.naturalWidth, fh / imgEl.naturalHeight);
      const effectiveZoom = zoom * base;
      const sourceX = -offset.x / effectiveZoom;
      const sourceY = -offset.y / effectiveZoom;
      const sourceW = fw / effectiveZoom;
      const sourceH = fh / effectiveZoom;

      const outW = Math.min(1600, Math.round(fw * 2));
      const outH = Math.round(outW / aspectRatio);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not process image');
      ctx.drawImage(imgEl, sourceX, sourceY, sourceW, sourceH, 0, 0, outW, outH);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not export image')), 'image/jpeg', 0.88);
      });

      const url = await api.uploadSiteImage(blob, folder);
      onUploaded(url);
      setModalOpen(false);
      setImgSrc(null);
      setImgEl(null);
    } catch {
      setError('Could not upload the image. Please try again.');
    }
    setUploading(false);
  };

  const closeModal = () => {
    setModalOpen(false);
    setImgSrc(null);
    setImgEl(null);
    setError('');
  };

  return (
    <>
      <div className={`image-uploader-trigger ${className}`}>
        {currentUrl ? (
          <img src={currentUrl} alt="Current" className="uploader-preview" />
        ) : (
          <div className="uploader-placeholder"><ImageIcon size={24} /></div>
        )}
        <label className="uploader-button">
          <Upload size={14} /> {label}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileSelected} style={{ display: 'none' }} />
        </label>
      </div>

      {modalOpen && imgSrc && (
        <div className="crop-modal-overlay" onMouseDown={closeModal}>
          <div className="crop-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="crop-modal-header">
              <h3>Adjust your picture</h3>
              <button className="crop-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <p className="crop-hint">Drag to position, zoom to fit the frame exactly.</p>
            <div
              className="crop-frame"
              ref={frameRef}
              style={{ aspectRatio: String(aspectRatio) }}
              onMouseDown={onMouseDown}
              onTouchStart={onMouseDown}
            >
              <img
                src={imgSrc}
                alt="Preview"
                className="crop-image"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom * getBaseScale() / Math.min(
                    frameRef.current ? frameRef.current.clientWidth / (imgEl?.naturalWidth || 1) : 1,
                    frameRef.current ? frameRef.current.clientHeight / (imgEl?.naturalHeight || 1) : 1,
                  )})`,
                }}
                draggable={false}
              />
            </div>
            <div className="crop-controls">
              <button className="crop-zoom-btn" onClick={() => handleZoom(-0.25)}><ZoomOut size={18} /></button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={zoom}
                onChange={(e) => { const z = parseFloat(e.target.value); setZoom(z); setOffset((o) => clampOffset(o.x, o.y, z)); }}
                className="crop-slider"
              />
              <button className="crop-zoom-btn" onClick={() => handleZoom(0.25)}><ZoomIn size={18} /></button>
            </div>
            {error && <div className="crop-error">{error}</div>}
            <div className="crop-actions">
              <button className="button button-outline" onClick={closeModal} disabled={uploading}>Cancel</button>
              <button className="button button-dark" onClick={confirmCrop} disabled={uploading}>
                {uploading ? 'Uploading...' : <><Check size={16} /> Save picture</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
