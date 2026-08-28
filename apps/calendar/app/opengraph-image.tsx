import { ImageResponse } from 'next/og'
import { APP_SUBTITLE, APP_TITLE } from '@/lib/metadata'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '72px',
        color: '#000000',
      }}
    >
      {/*
        The light artwork, inlined, because this runs through Satori: it has no
        access to the public/ directory over a relative URL and no CSS dark mode.
        The card background below is fixed white, so the light variant is the
        correct one rather than a fallback.
      */}
      <svg
        width="100"
        height="100"
        viewBox="0 0 1000 1000"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M445 31.7543C479.034 12.1047 520.966 12.1047 555 31.7543L878.013 218.246C912.047 237.895 933.013 274.209 933.013 313.509V686.491C933.013 725.791 912.047 762.105 878.013 781.754L555 968.246C520.966 987.895 479.034 987.895 445 968.246L121.987 781.754C87.9532 762.105 66.9873 725.791 66.9873 686.491V313.509C66.9873 274.209 87.9532 237.895 121.987 218.246L445 31.7543Z"
          fill="url(#og-grad)"
        />
        <rect
          width="396.063"
          height="396.063"
          rx="50"
          transform="matrix(0.866025 0.5 0 1 157 301.2)"
          fill="#E6E6E6"
        />
        <path
          d="M287.6 670.334C277.475 664.488 268.375 657.102 260.302 648.175C252.366 639.327 245.867 629.254 240.804 617.957C235.878 606.739 233.004 594.968 232.183 582.644L258.866 598.049C260.097 609.188 263.107 618.747 267.896 626.726C272.686 634.705 279.048 640.986 286.985 645.568C294.1 649.676 299.847 650.703 304.225 648.649C308.741 646.674 310.999 641.42 310.999 632.888C310.999 624.356 308.809 616.219 304.431 608.477C300.189 600.814 293.484 594.336 284.316 589.043L269.333 580.393V556.456L283.701 564.751C291.774 569.412 297.726 570.636 301.557 568.424C305.525 566.133 307.509 561.433 307.509 554.323C307.509 547.213 305.731 540.498 302.173 534.178C298.752 527.937 293.484 522.762 286.369 518.654C279.801 514.862 274.122 513.875 269.333 515.692C264.681 517.43 261.876 522.446 260.918 530.741L233.825 515.099C234.92 505.145 237.725 497.68 242.24 492.703C246.893 487.805 253.05 485.514 260.713 485.83C268.375 485.988 277.201 488.95 287.19 494.717C297.042 500.405 305.594 507.239 312.846 515.218C320.098 523.039 325.708 531.492 329.676 540.577C333.781 549.583 335.834 558.747 335.834 568.069C335.834 576.127 334.26 582.249 331.113 586.436C327.966 590.623 323.861 592.993 318.798 593.546C313.872 594.02 308.672 592.677 303.199 589.517L302.583 584.185C310.246 588.609 316.814 594.455 322.287 601.723C327.76 608.833 331.934 616.614 334.807 625.067C337.818 633.599 339.323 642.131 339.323 650.663C339.323 660.617 337.065 668.083 332.55 673.06C328.171 677.958 322.082 680.209 314.283 679.814C306.483 679.261 297.589 676.101 287.6 670.334ZM385.94 724.741V581.356L389.839 586.451C387.924 590.085 384.913 592.85 380.809 594.746C376.704 596.484 371.914 597.274 366.441 597.116C360.968 596.958 355.084 595.694 348.79 593.324V563.699C354.263 565.911 359.805 567.057 365.415 567.136C371.025 567.215 376.088 566.425 380.603 564.766C385.119 562.949 388.334 560.223 390.25 556.589L412.006 569.15V739.79L385.94 724.741Z"
          fill="#141414"
        />
        <defs>
          <linearGradient
            id="og-grad"
            x1="1160.17"
            y1="111.3"
            x2="270.865"
            y2="655.93"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="#A2A2A2" />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 500,
            fontFamily: 'Instrument Sans',
            lineHeight: 1.1,
          }}
        >
          {APP_TITLE}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 400,
            fontFamily: 'Instrument Sans',
            lineHeight: 1.2,
          }}
        >
          {APP_SUBTITLE}
        </div>
      </div>
    </div>,
    size,
  )
}
