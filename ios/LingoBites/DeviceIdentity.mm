#import "DeviceIdentity.h"
#import <UIKit/UIKit.h>

@implementation DeviceIdentity

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getIdentifierForVendor:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    // identifierForVendor is nil until the device has unlocked at least once
    // after boot and resets when the last same-vendor app is removed. Both
    // cases resolve to null so JS takes the validated UUID fallback path.
    NSString *ifv = [[[UIDevice currentDevice] identifierForVendor] UUIDString];
    resolve(ifv);
  } @catch (NSException *exception) {
    reject(@"E_DEVICE_ID", @"Unable to read identifierForVendor.", nil);
  }
}

@end
