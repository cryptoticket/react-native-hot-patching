# React Native Hot Patching

React Native package that in background downloads bundles from the remote server and reloads bundles dynamically. App review process may take a long time so it might be useful to have the ability to update the app immediately in case of hot fixes. Should be used together with [rn-version-admin](https://github.com/cryptoticket/rn-version-admin). The primary goal of this package is to provide a mechanism for app hot patching(when there's a critical bug in your app and app review takes a long time then hot patching can help) not constant app updating.

NOTICE: only JS code can be updated via hot patching. So if you have any native changes in your code they won't be applied in JS bundle.

# How to install

1. Install npm package
```
npm i @cryptoticket/react-native-hot-patching --save
```
2. Add [react-native-fs](https://github.com/itinance/react-native-fs) to your app. Used as a peer dependency for bundle downloading.
3. Add [react-native-zip-archive](https://github.com/mockingbot/react-native-zip-archive) to your app. Used as a peer dependency for unzipping bundle(to get JS bundle file and app assets).
4. Add [react-native-dynamic-bundle](https://github.com/mauritsd/react-native-dynamic-bundle) to your app. Used as a peer dependency for bundle management. NOTICE: use latest version from github, not from npm.
5. Deploy [rn-version-admin](https://github.com/cryptoticket/rn-version-admin) service where you should upload zipped bundles.
6. Init package on app start
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

try {
  await RNHotPatching.init({
    url: 'https://bundle-update.com', // rn-version-admin address 
    appVersion: version // app version from package.json
  });
} catch(err) {
    console.log('Error on RNHotPatching.init()');
    console.log(err);
}
```

# What is going on in background

## Case 1
If current app version (from package.json) is `1.0.0` and there is an active bundle(on the server side) with version `1.0.1`, `is_update_required` field set to `true` and `apply_from_version` is set to `1.0.0` then:
- bundle with version `1.0.1` will be downloaded and saved on the device
- bundle with version `1.0.1` will be set as active
- when user opens app the next time then version `1.0.1` will be opened

## Case 2
If current app version (from package.json) is `1.0.0` and there is an active bundle(on the server side) with version `1.0.2`, `is_update_required` field set to `true` and `apply_from_version` is set to `1.0.1` then:
- bundle is NOT downloaded because current app version `1.0.0` < minimum required version `1.0.1` from `apply_from_version` field

## Case 3
If current app version is `1.0.1`(updated via hot patching, "real" version in package.json is `1.0.0`) and app is updated to version `1.0.1` via app store then:
- active bundle is set to `null`
- when user opens app the next time then version `1.0.1` from the app store will be opened

## Case 4
If current app version is `1.0.2`(from package.json) and there is a bundle with version `1.0.1` still saved then:
- bundle with version `1.0.1` is unregistered and deleted physically


# Methods

### getCurrentAppVersion(appVersion: string)
**appVersion**: app version from package.json

Returns current app version(from `package.json` or from bundle that was previously downloaded via hot patching). In most cases you should not use this method directly as `init()` handles everything out-of-the-box.

Example:
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

const appVersion = RNHotPatching.getCurrentAppVersion(version);
console.log(appVersion); // version from package.json or currently active bundle
```

### init(options: Object)
**options**: init options. You should set `url` param of the deployed [rn-version-admin](https://github.com/cryptoticket/rn-version-admin) service and `appVersion` param with the app version from `package.json`.

Initializes bundle plugin. This method **MUST** be called on app start.

Example:
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

try {
  await RNHotPatching.init({
      url: 'https://bundle-update.com', // rn-version-admin address 
      appVersion: version // app version from package.json
  });
} catch(err) {
	console.log('Error on RNHotPatching.init()');
    console.log(err);
}
```

### isActivationRequired(currentAppVersion: string, remoteBundleData: Object)
**currentAppVersion**: current app version (from `package.json` or previously downloaded bundle)

**remoteBundleData**: remote bundle data object from `rn-version-admin`. Example:
```
{
    "_id": "5e599743ee4d7e37ed0d0254",
    "platform": "android",
    "storage": "file",
    "version": "1.0.1", // required
    "is_update_required": false, // required
    "apply_from_version": "1.0.0", // required
    "url": "http://localhost:3000/static/bundles/1.0.0/android.bundle.zip",
    "desc": "test",
    "created_at": "2020-02-28T22:42:12.005Z",
    "updated_at": "2020-02-28T22:42:12.005Z"
}
```

Checks whether bundle should be downloaded from the remote server and set as active. Returns true only when:
- `remoteBundleData.is_update_required` is `true`
- `remoteBundleData.apply_from_version` <= current app version < `remoteBundleData.version`

In most cases you should not use this method directly as `init()` handles everything out-of-the-box.

Example:
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

const appVersion = RNHotPatching.getCurrentAppVersion(version);
const isActivationRequired = RNHotPatching.isActivationRequired(appVersion, {is_update_required: true, version: '1.0.1', apply_from_version: '1.0.0'});
console.log(isActivationRequired); // whether bundle should be downloaded and set as active
```

### removeStaleBundles(appVersion: string)
**appVersion**: app version from `package.json`

Removes stale bundles. If your app version from `package.json` is `1.0.1` and there is a previously downloaded bundle with version `1.0.0` then `1.0.0` will be removed from the file system. In most cases you should not use this method directly as `init()` handles everything out-of-the-box.

Example:
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

RNHotPatching.removeStaleBundles(version);
```

### reset()

Removes all downloaded bundles, resets default bundle to the one from the app store and immediately reloads the app.

Example:
```
import RNHotPatching from '@cryptoticket/react-native-hot-patching';
import { version } from './package.json';

RNHotPatching.reset();
```

## How to run tests
```
npm run test
```
