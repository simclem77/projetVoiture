import React from 'react';
import Tooltip from './Tooltip';

/**
 * Composant StackedBarChart pour les graphiques TCO empilés (5 catégories avec "Banque")
 */
const StackedBarChart = ({ breakdown, type, vehicleName, motorisation, maxValue }) => {
  // Fonction pour déterminer le label "Banque" selon le type de financement
  const getBanqueLabel = (type) => {
    switch(type) {
      case 'leasing': return 'Loyer';
      case 'credit': return 'Dépréciation + Intérêts';
      case 'comptant': return 'Dépréciation';
      default: return 'Banque';
    }
  };

  // Fonction pour déterminer le tooltip "Banque" selon le type de financement
  const getBanqueTooltip = (type) => {
    switch(type) {
      case 'leasing': return 'Loyer mensuel payé à la banque (financement de l\'utilisation)';
      case 'credit': return 'Coût mensuel de la dépréciation du véhicule + intérêts du crédit';
      case 'comptant': return 'Coût mensuel de la dépréciation du véhicule (perte de valeur)';
      default: return 'Mensualité brute payée (flux réel sortant vers l\'organisme de financement)';
    }
  };

  const categories = [
    { key: 'apportLisse', label: 'Apport Lissé', tooltip: 'Coût net de l\'apport (après déduction de la valeur de revente)' },
    { key: 'banque', label: getBanqueLabel(type), tooltip: getBanqueTooltip(type) },
    { key: 'energie', label: 'Énergie', tooltip: motorisation === 'ICE' ? 'Essence uniquement' : motorisation === 'BEV' ? 'Électricité uniquement' : 'Mix PHEV (électricité + essence)' },
    { key: 'fraisFixes', label: 'Frais Fixes', tooltip: 'Assurance + Impôt + Vignette + Parking + Entretien' },
    { key: 'opportunite', label: 'Opportunité', tooltip: 'Gain manqué sur le placement' }
  ];

  // Couleurs selon le type de financement (5 catégories avec dégradation logique)
  const colorSchemes = {
    leasing: {
      apportLisse: 'bg-blue-950',    // Nuance 950 (très sombre)
      banque: 'bg-blue-700',         // Nuance 700 (sombre)
      energie: 'bg-blue-500',        // Nuance 500 (moyen)
      fraisFixes: 'bg-blue-300',     // Nuance 300 (clair)
      opportunite: 'bg-blue-200'     // Nuance 200 (pastel)
    },
    credit: {
      apportLisse: 'bg-emerald-950', // Nuance 950 (très sombre)
      banque: 'bg-emerald-700',      // Nuance 700 (sombre)
      energie: 'bg-emerald-500',     // Nuance 500 (moyen)
      fraisFixes: 'bg-emerald-300',  // Nuance 300 (clair)
      opportunite: 'bg-emerald-200'  // Nuance 200 (pastel)
    },
    comptant: {
      apportLisse: 'bg-purple-950',  // Nuance 950 (très sombre)
      banque: 'bg-purple-700',       // Nuance 700 (sombre)
      energie: 'bg-purple-500',      // Nuance 500 (moyen)
      fraisFixes: 'bg-purple-300',   // Nuance 300 (clair)
      opportunite: 'bg-purple-200'   // Nuance 200 (pastel)
    }
  };

  const colors = colorSchemes[type] || colorSchemes.leasing;
  const effectiveMaxValue = maxValue || breakdown.total;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-slate-700 text-sm">
          {type === 'leasing' ? 'Leasing' : type === 'credit' ? 'Crédit' : 'Comptant'}
        </span>
        <span className="font-black text-slate-900 text-xl">{breakdown.total.toFixed(0)} CHF</span>
      </div>
      
      <div className="w-full h-6 bg-slate-100 rounded-full overflow-visible flex relative z-30">
        {categories.map((category, catIndex) => {
          const value = breakdown[category.key];
          const percentage = (value / effectiveMaxValue) * 100;
          
          if (value <= 0) return null;
          
          // Trouver le premier et dernier segment visible
          const visibleCategories = categories.filter(cat => breakdown[cat.key] > 0);
          const isFirstVisible = catIndex === categories.findIndex(cat => breakdown[cat.key] > 0);
          const isLastVisible = catIndex === categories.findLastIndex(cat => breakdown[cat.key] > 0);
          
          let roundedClasses = '';
          if (isFirstVisible) roundedClasses += ' rounded-l-full';
          if (isLastVisible) roundedClasses += ' rounded-r-full';
          
          return (
            <Tooltip
              key={category.key}
              content={`${category.label}: ${value.toFixed(0)} CHF`}
              position="top"
              width={`${percentage}%`}
            >
              <div
                className={`h-full w-full ${colors[category.key]} transition-all duration-300 hover:opacity-90 ${roundedClasses}`}
              >
                {/* Supprimé le texte blanc à l'intérieur */}
              </div>
            </Tooltip>
          );
        })}
      </div>
      
      {/* Légende des segments */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {categories.map(category => {
          const value = breakdown[category.key];
          if (value <= 0) return null;
          
          return (
            <Tooltip
              key={category.key}
              content={`${category.label}: ${value.toFixed(0)} CHF - ${category.tooltip}`}
              position="top"
            >
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 cursor-help">
                <div className={`w-2 h-2 ${colors[category.key]} rounded`}></div>
                <span className="text-slate-700 font-medium">{category.label}</span>
                <span className="text-slate-500">{value.toFixed(0)}</span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

export default StackedBarChart;