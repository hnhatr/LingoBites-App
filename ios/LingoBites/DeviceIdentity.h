#import <React/RCTBridgeModule.h>

/**
 * Platform device-identifier adapter (SETE-303 / T6).
 *
 * Exposes `UIDevice.identifierForVendor` to JS. Validation and the random
 * UUID fallback live in JS; a nil IFV resolves to null so a missing
 * identifier stays on the normal fallback path.
 */
@interface DeviceIdentity : NSObject <RCTBridgeModule>
@end
