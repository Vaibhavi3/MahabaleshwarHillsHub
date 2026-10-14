import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiMaximize, FiGrid } from 'react-icons/fi';
import { parseProductSize, FOOTWEAR_SIZE_CHART, KIDS_AGE_CHART, euInRange } from '../utils/sizeGuide';

const Disclaimer = ({ children }) => (
  <p className="text-xs text-muted italic mt-4">{children}</p>
);

const HowToMeasure = ({ kind }) => {
  if (kind === 'sock') {
    return (
      <div className="space-y-3 text-sm text-ink leading-relaxed">
        <p>These are stretch-knit socks, so "One Size" is the sock's own flat, relaxed length - not a shoe size.</p>
        <ol className="list-decimal list-inside space-y-1 text-muted">
          <li>Lay the sock flat and smooth out any folds.</li>
          <li>Measure from the back of the heel to the tip of the toe, in centimetres.</li>
          <li>Compare that to your own foot length, measured the same way while standing.</li>
        </ol>
        <p className="text-muted">
          Stretch-knit fabric typically gives a few centimetres of extra room, so a sock measuring close to your
          foot length (or a little shorter) will usually still fit comfortably.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-ink leading-relaxed">
      <p>Measure your foot length and match it against the chart to pick your size.</p>
      <ol className="list-decimal list-inside space-y-1 text-muted">
        <li>Stand on a sheet of paper with your heel against a wall.</li>
        <li>Mark the wall edge and the tip of your longest toe on the paper.</li>
        <li>Measure the distance between the two marks, in centimetres.</li>
        <li>Measure both feet (in the evening, when feet are largest) and use the longer one.</li>
      </ol>
      {kind === 'kids' && (
        <p className="text-muted">For growing feet, it's usually safer to size up rather than down.</p>
      )}
      <Disclaimer>
        General reference only - exact fit can vary a little between styles, as it does across every brand.
      </Disclaimer>
    </div>
  );
};

const FootwearChart = ({ tokens }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-xs uppercase text-muted">
          <th className="py-2 pr-4">EU</th>
          <th className="py-2 pr-4">UK</th>
          <th className="py-2 pr-4">US</th>
          <th className="py-2">Foot length</th>
        </tr>
      </thead>
      <tbody>
        {FOOTWEAR_SIZE_CHART.map((row) => {
          const matched = tokens.some((t) => euInRange(row.eu, t));
          return (
            <tr
              key={row.eu}
              className={`border-b border-gray-100 ${matched ? 'bg-brand-light/30 font-semibold text-ink' : 'text-muted'}`}
            >
              <td className="py-2 pr-4">{row.eu}</td>
              <td className="py-2 pr-4">{row.uk}</td>
              <td className="py-2 pr-4">{row.us}</td>
              <td className="py-2">{row.cm} cm</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <Disclaimer>
      General EU/UK/US guide - highlighted rows are the sizes available on this listing. Brands vary by a few
      millimetres, so use this alongside your own measurement.
    </Disclaimer>
  </div>
);

const KidsChart = ({ tokens }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left border-collapse">
      <thead>
        <tr className="border-b border-gray-200 text-xs uppercase text-muted">
          <th className="py-2 pr-4">Age</th>
          <th className="py-2">Typical foot length</th>
        </tr>
      </thead>
      <tbody>
        {KIDS_AGE_CHART.map((row) => {
          const matched = tokens.includes(row.age);
          return (
            <tr
              key={row.age}
              className={`border-b border-gray-100 ${matched ? 'bg-brand-light/30 font-semibold text-ink' : 'text-muted'}`}
            >
              <td className="py-2 pr-4">{row.label}</td>
              <td className="py-2">{row.foot}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <Disclaimer>
      General age-to-foot-length guide - highlighted row(s) match this listing. Every child grows differently, so
      check your child's actual foot length if you can.
    </Disclaimer>
  </div>
);

const SockChart = ({ tokens, raw }) => (
  <div className="text-sm text-ink leading-relaxed space-y-3">
    <p>
      {tokens.length > 0 ? (
        <>
          This listing's flat (relaxed) length: <span className="font-bold">{tokens.map((t) => `${t} cm`).join(', ')}</span>
        </>
      ) : (
        <>Listed size: <span className="font-bold">{raw}</span></>
      )}
    </p>
    <p className="text-muted">
      Measured heel-to-toe while the sock is laid flat, before it stretches onto your foot.
    </p>
    <Disclaimer>
      Handmade in small batches, so lengths can vary by half a centimetre or so piece to piece.
    </Disclaimer>
  </div>
);

const RawFallback = ({ raw }) => (
  <div className="text-sm text-ink leading-relaxed space-y-3">
    <p>
      Listed size: <span className="font-bold">{raw}</span>
    </p>
    <p className="text-muted">
      This piece is handmade, so we've kept the maker's own size note above rather than forcing it into a
      standard chart.
    </p>
  </div>
);

const SizeGuideModal = ({ product, onClose }) => {
  const [tab, setTab] = useState('chart');
  const parsed = parseProductSize(product);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const hasChart = parsed.kind === 'footwear' || parsed.kind === 'kids';

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Size & Fit Guide"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="font-extrabold text-ink flex items-center gap-2">
            <FiMaximize className="text-brand" /> Size & Fit Guide
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-ink">
            <FiX size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('chart')}
            className={`flex-1 py-3 text-sm font-bold uppercase flex items-center justify-center gap-2 ${
              tab === 'chart' ? 'text-brand border-b-2 border-brand' : 'text-muted'
            }`}
          >
            <FiGrid /> {hasChart ? 'Size Chart' : 'This Item'}
          </button>
          <button
            onClick={() => setTab('measure')}
            className={`flex-1 py-3 text-sm font-bold uppercase flex items-center justify-center gap-2 ${
              tab === 'measure' ? 'text-brand border-b-2 border-brand' : 'text-muted'
            }`}
          >
            <FiMaximize /> How to Measure
          </button>
        </div>

        <div className="p-6">
          {tab === 'chart' ? (
            parsed.kind === 'footwear' ? (
              <FootwearChart tokens={parsed.tokens} />
            ) : parsed.kind === 'kids' ? (
              <KidsChart tokens={parsed.tokens} />
            ) : parsed.kind === 'sock' ? (
              <SockChart tokens={parsed.tokens} raw={parsed.raw} />
            ) : (
              <RawFallback raw={parsed.raw} />
            )
          ) : (
            <HowToMeasure kind={parsed.kind} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SizeGuideModal;
