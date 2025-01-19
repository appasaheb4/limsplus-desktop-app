// filepath: /Users/appasaheb4/Documents/project/electon/limsplus-desktop-app/client/src/components/DigitalClock.tsx
import React, {useState, useEffect} from 'react';
import './style.css';

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return <div className="digital-clock">{formatTime(time)}</div>;
};
