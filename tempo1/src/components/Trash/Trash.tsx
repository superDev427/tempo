import { forwardRef } from 'react';
import styles from './Trash.module.css';

interface TrashProps {
  readonly armed: boolean;
}

export const Trash = forwardRef<HTMLDivElement, TrashProps>(function Trash({ armed }, ref) {
  return (
    <div ref={ref} className={`${styles.trash} ${armed ? styles.armed : ''}`} aria-label="Trash zone">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span className={styles.icon} aria-hidden>×</span>
        <span className={styles.label}>{armed ? 'Drop' : 'Trash'}</span>
      </div>
    </div>
  );
});
