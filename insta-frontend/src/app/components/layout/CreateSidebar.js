// dashboard/components/CreateSidebar.js
import styles from '../../dashboard/dashboard.module.css';

export default function CreateSidebar({ onClose, onOptionClick }) {
  const options = [
    { path: '/create', icon: '📝', title: 'Post', desc: 'Share a photo or video' },
    { path: '/create-reel', icon: '🎥', title: 'Reel', desc: 'Create a short video' },
    { path: '/create-story', icon: '📸', title: 'Story', desc: 'Share a moment' },
    { path: '/live', icon: '🔴', title: 'Live', desc: 'Go live with your followers' },
  ];

  return (
    <>
      <div className={styles.createOverlay} onClick={onClose}></div>
      <aside className={styles.createSidebar}>
        <div className={styles.createSidebarContent}>
          <div className={styles.createHeader}>
            <h3>Create</h3>
            <button onClick={onClose} className={styles.closeButton}>✕</button>
          </div>
          
          <div className={styles.createOptions}>
            {options.map(opt => (
              <button 
                key={opt.path}
                onClick={() => onOptionClick(opt.path)}
                className={styles.createOption}
              >
                <span className={styles.createIcon}>{opt.icon}</span>
                <div className={styles.createOptionText}>
                  <span className={styles.createOptionTitle}>{opt.title}</span>
                  <span className={styles.createOptionDesc}>{opt.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
