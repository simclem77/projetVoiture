import React, { useState, useEffect } from 'react';

/**
 * Composant pour la saisie numérique avec gestion optimisée pour mobile
 * Ce composant gère un état local en texte pour permettre de taper "." ou ","
 * sans que le curseur ne saute ou que le caractère disparaisse.
 */
const NumericInput = ({ value, onChange, className, placeholder, inputMode = "decimal" }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || "");

  // Synchronisation si la valeur change de l'extérieur
  useEffect(() => {
    const stringValue = value?.toString() || "";
    if (parseFloat(localValue) !== value && localValue !== stringValue) {
      setLocalValue(stringValue);
    }
  }, [value]);

  const handleChange = (e) => {
    const rawValue = e.target.value;
    const normalizedValue = rawValue.replace(',', '.');

    // On met à jour l'affichage immédiatement (autorise "7." temporairement)
    setLocalValue(rawValue);

    // On propage le nombre au parent uniquement si c'est valide
    const parsed = parseFloat(normalizedValue);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (rawValue === "") {
      onChange(0);
    }
  };

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={localValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
    />
  );
};

export default NumericInput;