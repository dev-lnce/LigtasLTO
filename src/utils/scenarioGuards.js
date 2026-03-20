import { DEMO_MODE } from '../config.js';

export const CHECK_GEOFENCE = (targetLat, targetLng) => {
  return new Promise((resolve) => {
    if (DEMO_MODE) {
      console.warn('[DEMO MODE] Geofence check bypassed.');
      resolve({ allowed: true });
      return;
    }

    if (!navigator.geolocation) {
      resolve({ allowed: false, error: 'Geolocation is not supported by your browser' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const R = 6371e3; // metres
        const lat1 = position.coords.latitude * Math.PI/180;
        const lat2 = targetLat * Math.PI/180;
        const deltaLat = (targetLat-position.coords.latitude) * Math.PI/180;
        const deltaLon = (targetLng-position.coords.longitude) * Math.PI/180;

        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance > 500) {
          resolve({ allowed: false, error: 'Kailangan mong nasa loob ng 500 metro ng branch para mag-submit.' });
        } else {
          resolve({ allowed: true });
        }
      },
      (error) => {
        resolve({ allowed: false, error: 'Cannot get location. Make sure GPS is on.' });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

export const IS_DURING_LUNCH_BREAK = (operatingHours) => {
  if (!operatingHours || !operatingHours.breaks) return false;
  const now = new Date();
  const currentMinutesOffset = now.getHours() * 60 + now.getMinutes();

  return operatingHours.breaks.some(b => {
    const [hStart, mStart] = b.start.split(':').map(Number);
    const [hEnd, mEnd] = b.end.split(':').map(Number);
    
    const startMinutes = hStart * 60 + mStart;
    const endMinutes = hEnd * 60 + mEnd;
    
    return currentMinutesOffset >= startMinutes && currentMinutesOffset < endMinutes;
  });
};

export const HANDLE_HOLD_TO_SUBMIT = (callback) => {
  if (DEMO_MODE) {
    return {
      onClick: () => callback(),
    };
  }

  let holdTimer = null;
  return {
    onPointerDown: (e) => {
      e.currentTarget.classList.add('holding');
      holdTimer = setTimeout(() => {
        e.currentTarget.classList.remove('holding');
        callback();
      }, 2000); // 2000ms hold
    },
    onPointerUp: (e) => {
      if (holdTimer) clearTimeout(holdTimer);
      e.currentTarget.classList.remove('holding');
    },
    onPointerCancel: (e) => {
      if (holdTimer) clearTimeout(holdTimer);
      e.currentTarget.classList.remove('holding');
    },
    onPointerLeave: (e) => {
      if (holdTimer) clearTimeout(holdTimer);
      e.currentTarget.classList.remove('holding');
    }
  };
};
