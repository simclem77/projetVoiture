const parseDecimal = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  if (value.trim() === '') return 0;
  
  let normalized = value.replace(',', '.');
  normalized = normalized.replace(/['’\s]/g, '');
  const cleaned = normalized.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

console.log("Test parseDecimal:");
console.log('"7.5" ->', parseDecimal("7.5"));
console.log('"7,5" ->', parseDecimal("7,5"));
console.log('"52,037" ->', parseDecimal("52,037"));
console.log('"52.037" ->', parseDecimal("52.037"));
console.log('"2,9" ->', parseDecimal("2,9"));
console.log('"2.9" ->', parseDecimal("2.9"));
console.log('"0,99" ->', parseDecimal("0,99"));
console.log('"0.99" ->', parseDecimal("0.99"));
