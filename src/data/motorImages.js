import { MOTOR_IMAGES_BASE64 } from './motorImagesBase64';

export const MOTOR_IMAGES = {
  'FRD10GD': require('./motorImages/FRD10GD.webp'),
  'FRD15': require('./motorImages/FRD15.webp'),
  'FRD15S': require('./motorImages/FRD15.webp'),
  'FRD21E': require('./motorImages/FRD21E.webp'),
  'FRD21M': require('./motorImages/FRD21M.webp'),
  'FRD32E': require('./motorImages/FRD32E.webp'),
  'FRD32X': require('./motorImages/FRD32X.webp'),
  'FRD40E': require('./motorImages/FRD40E.webp'),
  'FRD40W': require('./motorImages/FRD40W.webp'),
  'FRD40WA': require('./motorImages/FRD40W.webp'),
  'FRD45D': require('./motorImages/FRD45D.webp'),
  'FRD48': require('./motorImages/FRD48.webp'),
  'FRD52A': require('./motorImages/FRD52A.webp'),
  'FRD52D': require('./motorImages/FRD52D.webp'),
  'FRD52K': require('./motorImages/FRD52K.webp'),
  'FRD71': require('./motorImages/FRD71.webp'),
  'FRD82': require('./motorImages/FRD82.webp')
};

export const AVAILABLE_MOTOR_IMAGE_KEYS = Object.keys(MOTOR_IMAGES);

// Modele göre eşleşen motor görselini bulur (React Native Image Source için)
export const getMotorImage = (model) => {
  if (!model) return null;
  if (typeof model === 'string' && (
    model.startsWith('data:') ||
    model.startsWith('file:') ||
    model.startsWith('content:') ||
    model.startsWith('http:') ||
    model.startsWith('https:') ||
    model.startsWith('ph:')
  )) {
    return { uri: model };
  }
  if (typeof model === 'object' && model.uri) {
    return model;
  }
  const cleanKey = String(model).trim().toUpperCase();
  if (MOTOR_IMAGES[cleanKey]) {
    return MOTOR_IMAGES[cleanKey];
  }
  const normalizedKey = cleanKey.replace(/[^A-Z0-9]/g, '');
  for (const k of AVAILABLE_MOTOR_IMAGE_KEYS) {
    if (k.replace(/[^A-Z0-9]/g, '') === normalizedKey) {
      return MOTOR_IMAGES[k];
    }
  }
  if (normalizedKey.startsWith('FRD40WA') || normalizedKey === 'FRD40WA') {
    return MOTOR_IMAGES['FRD40WA'] || MOTOR_IMAGES['FRD40W'] || null;
  }
  if (normalizedKey.startsWith('FRD15S') || normalizedKey === 'FRD15S') {
    return MOTOR_IMAGES['FRD15S'] || MOTOR_IMAGES['FRD15'] || null;
  }
  return null;
};

// Model için eşleşen anahtar adını döndürür
export const getMotorImageKey = (model) => {
  if (!model) return null;
  if (typeof model === 'string' && (
    model.startsWith('data:') ||
    model.startsWith('file:') ||
    model.startsWith('content:') ||
    model.startsWith('http:') ||
    model.startsWith('https:') ||
    model.startsWith('ph:') ||
    model.length > 50
  )) {
    return 'Özel Görsel';
  }
  const cleanKey = String(model).trim().toUpperCase();
  if (MOTOR_IMAGES[cleanKey]) {
    return cleanKey;
  }
  const normalizedKey = cleanKey.replace(/[^A-Z0-9]/g, '');
  for (const k of AVAILABLE_MOTOR_IMAGE_KEYS) {
    if (k.replace(/[^A-Z0-9]/g, '') === normalizedKey) {
      return k;
    }
  }
  if (normalizedKey.startsWith('FRD40WA') || normalizedKey === 'FRD40WA') return 'FRD40WA';
  if (normalizedKey.startsWith('FRD40W') || normalizedKey === 'FRD40W') return 'FRD40W';
  if (normalizedKey.startsWith('FRD15S') || normalizedKey === 'FRD15S') return 'FRD15S';
  if (normalizedKey.startsWith('FRD15') || normalizedKey === 'FRD15') return 'FRD15';
  return null;
};

// Modele göre eşleşen Base64 Data URI döndürür (PDF & HTML şablonu için)
export const getMotorImageBase64 = (model) => {
  if (!model) return null;
  if (typeof model === 'string' && (
    model.startsWith('data:') ||
    model.startsWith('file:') ||
    model.startsWith('content:') ||
    model.startsWith('http:') ||
    model.startsWith('https:')
  )) {
    return model;
  }
  const cleanKey = String(model).trim().toUpperCase();
  if (MOTOR_IMAGES_BASE64[cleanKey]) {
    return MOTOR_IMAGES_BASE64[cleanKey];
  }
  const normalizedKey = cleanKey.replace(/[^A-Z0-9]/g, '');
  for (const k of Object.keys(MOTOR_IMAGES_BASE64)) {
    if (k.replace(/[^A-Z0-9]/g, '') === normalizedKey) {
      return MOTOR_IMAGES_BASE64[k];
    }
  }
  if (normalizedKey.startsWith('FRD40WA') || normalizedKey === 'FRD40WA') {
    return MOTOR_IMAGES_BASE64['FRD40WA'] || MOTOR_IMAGES_BASE64['FRD40W'] || null;
  }
  if (normalizedKey.startsWith('FRD40W') || normalizedKey === 'FRD40W') {
    return MOTOR_IMAGES_BASE64['FRD40W'] || null;
  }
  if (normalizedKey.startsWith('FRD15S') || normalizedKey === 'FRD15S') {
    return MOTOR_IMAGES_BASE64['FRD15S'] || MOTOR_IMAGES_BASE64['FRD15'] || null;
  }
  if (normalizedKey.startsWith('FRD15') || normalizedKey === 'FRD15') {
    return MOTOR_IMAGES_BASE64['FRD15'] || null;
  }
  return null;
};
