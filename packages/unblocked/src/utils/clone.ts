const cloneBase = (object: any, base: any): any => {
  for (const key in object) {
    if (!Object.hasOwn(object, key)) continue;

    const value = object[key];

    if (typeof value === 'object' && value !== null) {
      base[key] = cloneBase(value, value.constructor());
    } else {
      base[key] = value;
    }
  }

  return base;
};

export const clone = <T extends object>(object: T): T => {
  return cloneBase(object, object.constructor());
};
