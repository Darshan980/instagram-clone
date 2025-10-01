
import React from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import styles from '../reels.module.css';
export const EmptyState = ({ onCreateClick }) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>📹</div>
    <h3>No reels yet</h3>
    <p>Be the first to create a reel!</p>
    <button onClick={onCreateClick}>
      <Plus size={16} />
      Create Your First Reel
    </button>
  </div>
);

export default EmptyState;
