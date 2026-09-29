import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiZoomIn, FiX } from 'react-icons/fi';

/**
 * Product image with a Myntra/Nykaa/Ajio-style zoom: a hover magnifier panel
 * next to the image on desktop, and a tap-to-open fullscreen lightbox on
 * every device (desktop click included, since it also doubles as the
 * "see it bigger" affordance on trackpads that can't easily hover-track).
 *
 * The image itself is never cropped or forced into a fixed aspect ratio -
 * both the inline image and the lightbox render it with object-contain at
 * its own natural size, exactly like the plain <img> this replaces.
 */
const ZOOM_FACTOR = 2.2;

const ZoomableImage = ({ src, alt }) => {
  const containerRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleMouseMove = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setLensPos({ x, y });
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen]);

  if (!src) {
    return <img src="https://via.placeholder.com/500" alt={alt} className="w-full h-auto block" />;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative w-full cursor-zoom-in"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setLightboxOpen(true)}
      >
        <img src={src} alt={alt} className="w-full h-auto block rounded" />

        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white/90 text-ink text-xs font-semibold px-2.5 py-1.5 rounded-full shadow-sm pointer-events-none">
          <FiZoomIn size={14} />
          <span className="hidden sm:inline">Tap to zoom</span>
        </span>

        {hovering && (
          <span
            className="hidden lg:block absolute w-24 h-24 border-2 border-white/80 bg-white/20 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
            style={{ left: `calc(${lensPos.x}% - 3rem)`, top: `calc(${lensPos.y}% - 3rem)` }}
          />
        )}

        {hovering && (
          <div
            className="hidden lg:block absolute top-0 left-full ml-4 w-full aspect-square bg-white border border-gray-200 rounded shadow-lg z-10 pointer-events-none"
            style={{
              backgroundImage: `url(${src})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${ZOOM_FACTOR * 100}%`,
              backgroundPosition: `${lensPos.x}% ${lensPos.y}%`,
            }}
          />
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-10"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close zoomed image"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          >
            <FiX size={22} />
          </button>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default ZoomableImage;
