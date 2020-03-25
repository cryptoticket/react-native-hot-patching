/**
 * React Native Hot Patching.
 * Downloads bundles from a server and reloads bundle on app restart.
 */

import axios from 'axios';
import { Platform } from 'react-native';
import { getActiveBundle, getBundles, registerBundle, reloadBundle, setActiveBundle, unregisterBundle } from 'react-native-dynamic-bundle';
import RNFS from 'react-native-fs';
import semver from 'semver';

/**
 * Returns current active app version.
 * Ex: app version from package.json: 1.0.0, bundle version: 1.0.1 => returns 1.0.1
 * Ex: app version from package.json: 1.0.0, bundle version: null => returns 1.0.0
 * Ex: app version from package.json: 1.0.1, bundle version: 1.0.0 => returns 1.0.1
 * @param {string} appVersion app version from package.json
 * @return {string} currently active app version
 */
async function getCurrentAppVersion(appVersion) {
	const bundleVersion = await getActiveBundle();
	if(!bundleVersion) {
		// if bundle is null then return app version from package.json
		return appVersion;
	} else {
		// return version that is greater
		return bundleVersion > appVersion ? bundleVersion : appVersion;
	}
};

/**
 * Initializes hot patching
 * @param {Object} options init params
 */
async function init(options = {}) {
	// validate options
	if(!options.url) throw new Error('RNHotPatching.init(): url can not be null');
	if(!options.appVersion) throw new Error('RNHotPatching.init(): appVersion can not be null');
	try {
		// get latest bundle version
		const resp = await axios.get(`${options.url}/api/v1/bundles/latest/${Platform.OS}`);
		// if response is empty then there are no bundles yet, return
		if(Object.keys(resp.data).length === 0) return;
		// check if we should download and activate bundle
		const currentAppVersion = await getCurrentAppVersion(options.appVersion);
		if(isActivationRequired(currentAppVersion, resp.data)) {
			// create bundle folder
			await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/bundles/${resp.data.version}`, {NSURLIsExcludedFromBackupKey: true});
			// download bundle
			await RNFS.downloadFile({
			    fromUrl: `${options.url}/static/bundles/${resp.data.version}/${Platform.OS}.bundle`,
				toFile: `${RNFS.DocumentDirectoryPath}/bundles/${resp.data.version}/${Platform.OS}.bundle`
			}).promise;
			// if bundle was downloaded then set it as active
			const bundleExists = await RNFS.exists(`${RNFS.DocumentDirectoryPath}/bundles/${resp.data.version}/${Platform.OS}.bundle`);
			if(bundleExists) {
				registerBundle(resp.data.version, `bundles/${resp.data.version}/${Platform.OS}.bundle`);
				setActiveBundle(resp.data.version);
			}
		}
		// if app was updated from the store and bundle exists then reset bundle to default
		const bundleVersion = await getActiveBundle();
		if(bundleVersion && options.appVersion >= bundleVersion) {
			setActiveBundle(null);
		}
		// remove bundles that are not used anymore
		await removeStaleBundles(options.appVersion);
	} catch(err) {
		console.log('Error on RNHotPatching.init()');
		console.log(err);
		throw err;
	}
};

/**
 * Checks whether plugin should download a bundle and set it as active.
 * Returns true only if ALL of the following conditions are met:
 * - remote bundle's is_update_required property is true
 * - app version >= remote bundle's apply_from_version property
 * - app version < remote bundle's version property
 * NOTICE: we need bundle's apply_from_version property because only none native bundle updates will be applied.
 * So you should track that active bundle does not have any native code changes.
 * @param {string} currentAppVersion current app version
 * @param {Object} remoteBundleData remote bundle data
 * @return {boolean} whether bundle should be downloaded and activated
 */
function isActivationRequired(currentAppVersion, remoteBundleData) {
	const isRemoteBundleUpdateRequired = remoteBundleData.is_update_required;
	// if "apply_from_version" exists and is in valid semver format then check that it is >= than "apply_from_version" field
	const isGreaterThanMin = semver.valid(remoteBundleData.apply_from_version) ? semver.gte(currentAppVersion, remoteBundleData.apply_from_version) : false;
	const isLessThanMax = semver.lt(currentAppVersion, remoteBundleData.version);
	return isRemoteBundleUpdateRequired && isGreaterThanMin && isLessThanMax;
};

/**
 * Removes stale bundles
 * @param {string} appVersion app version from package.json 
 */
async function removeStaleBundles(appVersion) {
	const bundles = await getBundles();
	for(let version of Object.keys(bundles)) {
		// if bundle version is less than app version from package.json
		if(version < appVersion) {
			unregisterBundle(version);
			// if bundle folder exists then delete it
			const bundleExists = await RNFS.exists(`${RNFS.DocumentDirectoryPath}/bundles/${version}`);
			if(bundleExists) {
				await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/bundles/${version}`);
			}
		}
	}
};

/**
 * Removes all bundles and resets app bundle to the one from app store
 */
async function reset() {
	const bundles = await getBundles();
	for(let version of Object.keys(bundles)) {
		unregisterBundle(version);
		const bundleExists = await RNFS.exists(`${RNFS.DocumentDirectoryPath}/bundles/${version}`);
		if(bundleExists) {
			await RNFS.unlink(`${RNFS.DocumentDirectoryPath}/bundles/${version}`);
		}
	}
	setActiveBundle(null);
	reloadBundle();
};

module.exports = {
	getCurrentAppVersion,
	init,
	isActivationRequired,
	removeStaleBundles,
	reset
};
