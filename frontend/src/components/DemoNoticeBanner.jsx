import { Info } from 'lucide-react';

function DemoNoticeBanner({ message }) {
  return (
    <div className="demo-banner" role="note">
      <Info size={18} className="demo-banner-icon" aria-hidden="true" />
      <span>
        <strong>UI Preview Mode:</strong>{' '}
        {message ||
          'Showing clearly labeled sample university data. Real MySQL records, login authentication, and Gemini AI will be connected in upcoming phases.'}
      </span>
    </div>
  );
}

export default DemoNoticeBanner;
