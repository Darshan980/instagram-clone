import React from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import styles from '../reels.module.css';

export const ErrorMessage = ({ error, onRetry }) => (
  <div className={styles.error}>
    <AlertCircle size={24} />
    <p>{error}</p>
    <button onClick={onRetry}>Try Again</button>
  </div>
);
export default ErrorMessage;
