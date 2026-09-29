export {
  IDENTIFIER_KINDS,
  canonicalizeIdentifier,
  isIdentifierKind,
  isValidIdentifierValue,
  resolveDeviceIdentifier,
} from './deviceIdentifier';
export type {
  DeviceIdentifier,
  IdentifierKind,
  RawPlatformIdentifiers,
  ResolveDeviceIdentifierDeps,
} from './deviceIdentifier';
export {readPlatformIdentifiers} from './deviceIdentityNative';
export type {ReadPlatformIdentifiersDeps} from './deviceIdentityNative';
