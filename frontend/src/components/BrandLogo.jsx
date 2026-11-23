import { GraduationCap } from 'lucide-react';

function BrandLogo({ compact = false, light = false }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.7rem',
      }}
    >
      <span
        style={{
          width: compact ? '34px' : '38px',
          height: compact ? '34px' : '38px',
          borderRadius: '10px',
          backgroundColor: light ? 'rgba(255, 255, 255, 0.14)' : '#0f2544',
          border: light ? '1px solid rgba(255, 255, 255, 0.22)' : 'none',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <GraduationCap size={compact ? 18 : 20} />
      </span>

      <div style={{ lineHeight: 1.2 }}>
        <div
          style={{
            fontSize: compact ? '0.95rem' : '1.02rem',
            fontWeight: 700,
            color: light ? '#ffffff' : '#0f223d',
            letterSpacing: '-0.01em',
          }}
        >
          Smart Campus
        </div>
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 500,
            color: light ? 'rgba(255, 255, 255, 0.72)' : '#6b7d96',
          }}
        >
          AI Campus Assistant
        </div>
      </div>
    </div>
  );
}

export default BrandLogo;
