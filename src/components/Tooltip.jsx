import React, { useState } from 'react';

/**
 * Composant Tooltip optimisé pour les barres empilées (sans gaps)
 */
const Tooltip = ({ children, content, position = 'top', width = '100%' }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className="relative h-full flex" // Ajout de h-full et flex ici
      style={{ width, flexShrink: 0 }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {/* On s'assure que l'enfant prend toute la place du Tooltip */}
      <div className="w-full h-full">
        {children}
      </div>
      
      {isVisible && (
        <div className={`
          absolute z-50 px-3 py-2 text-xs font-bold text-white bg-slate-800 rounded-lg shadow-lg
          whitespace-nowrap pointer-events-none
          ${position === 'top' ? 'bottom-full mb-2 left-1/2 transform -translate-x-1/2' : 'top-full mt-2 left-1/2 transform -translate-x-1/2'}
        `}>
          {content}
          <div className={`
            absolute w-2 h-2 bg-slate-800 transform rotate-45
            ${position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2' : 'bottom-full -mb-1 left-1/2 -translate-x-1/2'}
          `}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;