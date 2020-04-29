const axios = require('axios');
const RNFS = require('react-native-fs');

let RNHotPatching = require('./index');

// default mocks
jest.mock('axios', () => ({
	get: jest.fn(() => ({
		data: {}
	}))
}));
jest.mock('react-native', () => ({
	Platform: {
		OS: 'android'
	}
}));
jest.mock('react-native-dynamic-bundle', () => ({
	getActiveBundle: () => '1.0.0',
	getBundles: () => ({}),
	registerBundle: () => {},
	setActiveBundle: () => {}
}));
jest.mock('react-native-fs', () => ({
	downloadFile: () => ({
		promise: () => {}
	}),
	exists: () => true,
	mkdir: () => {}
}));
jest.mock('react-native-zip-archive', () => ({
	unzip: () => {}
}));

describe('React Native Hot Patching: Unit', () => {

	beforeEach(() => {
		jest.resetModules();
	});

    describe('getCurrentAppVersion()', () => {
        it('should return package.json version if bundle version does not exist', async () => {
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => null
			}));
			RNHotPatching = require('./index');
			const result = await RNHotPatching.getCurrentAppVersion('2.0.0');
            expect(result).toEqual('2.0.0');
		});

		it('should return bundle version if it is greater than package.json version', async () => {
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => '1.0.1'
			}));
			RNHotPatching = require('./index');
			const result = await RNHotPatching.getCurrentAppVersion('1.0.0');
            expect(result).toEqual('1.0.1');
		});
		
		it('should return package.json version if it is greater(or equal) than bundle version', async () => {
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => '1.0.1'
			}));
			RNHotPatching = require('./index');
			const result = await RNHotPatching.getCurrentAppVersion('2.0.0');
            expect(result).toEqual('2.0.0');
        });
	});

	describe('init()', () => {
        it('should throw if url option is null', async () => {
			let errorMsg = null;
			try {
				const invalidOptions = {
					url: null
				};
				await RNHotPatching.init(invalidOptions)
			} catch(err) {
				errorMsg = err.message;
			}
			expect(errorMsg).toEqual('RNHotPatching.init(): url can not be null');
		});

		it('should throw if appVersion option is null', async () => {
			let errorMsg = null;
			try {
				const invalidOptions = {
					url: 'https://site.com',
					appVersion: null
				};
				await RNHotPatching.init(invalidOptions)
			} catch(err) {
				errorMsg = err.message;
			}
			expect(errorMsg).toEqual('RNHotPatching.init(): appVersion can not be null');
		});

		it('should not initialize if there are no bundles yet on the backend', async () => {
			const options = {
				url: 'https://site.com',
				appVersion: '1.0.0'
			};
			RNHotPatching.getCurrentAppVersion = jest.fn();
			axios.get = jest.fn(() => ({
				data: {}
			}));
			await RNHotPatching.init(options);
			expect(RNHotPatching.getCurrentAppVersion).not.toHaveBeenCalled();
		});

		it('should download and activate bundle', async () => {
			const options = {
				url: 'https://site.com',
				appVersion: '1.0.0'
			};
			jest.mock('axios', () => ({
				get: jest.fn(() => ({
					data: {
						version: '1.0.1',
						is_update_required: true,
						apply_from_version: '1.0.0',
						url: 'https://site.com/static/bundles/1.0.1/android.bundle.zip'
					}
				}))
			}));
			const mockRNDBRegisterBundle = jest.fn();
			const mockRNDBSetActiveBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => '1.0.0',
				getBundles: () => ({}),
				registerBundle: mockRNDBRegisterBundle,
				setActiveBundle: mockRNDBSetActiveBundle
			}));
			const mockRNFSMkdir = jest.fn();
			const mockRNFSDownloadFile = jest.fn(() => ({ promise: jest.fn() }));
			const mockRNFSExists = jest.fn(() => true);
			const mockRNFSUnlink = jest.fn();
			jest.mock('react-native-fs', () => ({
				exists: mockRNFSExists,
				mkdir: mockRNFSMkdir,
				downloadFile: mockRNFSDownloadFile,
				unlink: mockRNFSUnlink,
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			const mockRNZAUnzip = jest.fn();
			jest.mock('react-native-zip-archive', () => ({
				unzip: mockRNZAUnzip
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.init(options);

			expect(mockRNFSMkdir).toHaveBeenCalledWith('ANY_PATH/bundles/1.0.1', {"NSURLIsExcludedFromBackupKey": true});
			expect(mockRNFSDownloadFile).toHaveBeenCalledWith({
				"fromUrl": "https://site.com/static/bundles/1.0.1/android.bundle.zip", 
				"toFile": "ANY_PATH/bundles/1.0.1/android.bundle.zip"
			});
			expect(mockRNZAUnzip).toHaveBeenCalledWith("ANY_PATH/bundles/1.0.1/android.bundle.zip", "ANY_PATH/bundles/1.0.1");
			expect(mockRNFSUnlink).toHaveBeenCalledWith("ANY_PATH/bundles/1.0.1/android.bundle.zip");
			expect(mockRNFSExists).toHaveBeenCalledWith("ANY_PATH/bundles/1.0.1/android.bundle");
			expect(mockRNDBRegisterBundle).toHaveBeenCalledWith("1.0.1", "bundles/1.0.1/android.bundle");
			expect(mockRNDBSetActiveBundle).toHaveBeenCalledWith("1.0.1");
			expect(mockRNDBSetActiveBundle).toHaveBeenCalledWith(null);
		});

		it('should not reset to default app bundle if active bundle is null', async () => {
			const options = {
				url: 'https://site.com',
				appVersion: '1.0.0'
			};
			jest.mock('axios', () => ({
				get: jest.fn(() => ({
					data: {
						version: '1.0.1',
						is_update_required: false
					}
				}))
			}));
			const mockRNDBSetActiveBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => null,
				getBundles: () => ({}),
				registerBundle: () => {},
				setActiveBundle: mockRNDBSetActiveBundle
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.init(options);

			expect(mockRNDBSetActiveBundle).not.toHaveBeenCalled();
		});

		it('should not reset to default app bundle if bundle version is greater than package.json version', async () => {
			const options = {
				url: 'https://site.com',
				appVersion: '1.0.0'
			};
			jest.mock('axios', () => ({
				get: jest.fn(() => ({
					data: {
						version: '1.0.1',
						is_update_required: false
					}
				}))
			}));
			const mockRNDBSetActiveBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => '1.0.1',
				getBundles: () => ({}),
				registerBundle: () => {},
				setActiveBundle: mockRNDBSetActiveBundle
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.init(options);

			expect(mockRNDBSetActiveBundle).not.toHaveBeenCalled();
		});
	});

	describe('isActivationRequired()', () => {
		it('should return true if remote bundle is required and current app version is in valid range', () => {
			expect(RNHotPatching.isActivationRequired('1.0.0', {
				is_update_required: true, 
				version: '1.0.1',
				apply_from_version: '1.0.0'
			})).toEqual(true);
		});

		it('should return false if remote bundle is not required and current app version is in valid range', () => {
			expect(RNHotPatching.isActivationRequired('1.0.0', {
				is_update_required: false, 
				version: '1.0.1',
				apply_from_version: '1.0.0'
			})).toEqual(false);
		});

		it('should return false if remote bundle is required and remote bundle apply_from_version field is invalid', () => {
			expect(RNHotPatching.isActivationRequired('1.0.0', {
				is_update_required: true, 
				version: '1.0.1',
				apply_from_version: 'INVALID'
			})).toEqual(false);
		});

		it('should return false if remote bundle is required and app version < remote bundle apply_from_version', () => {
			expect(RNHotPatching.isActivationRequired('1.0.0', {
				is_update_required: true, 
				version: '1.0.2',
				apply_from_version: '1.0.1'
			})).toEqual(false);
		});

		it('should return false if remote bundle is required and app version >= remote bundle version', () => {
			expect(RNHotPatching.isActivationRequired('1.0.2', {
				is_update_required: true, 
				version: '1.0.2',
				apply_from_version: '1.0.1'
			})).toEqual(false);
		});
	});

	describe('removeStaleBundles()', () => {
		it('should remove stale bundles', async () => {
			const mockRNDBUnregisterBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getBundles: () => ({
					'1.0.0': 'PATH_TO_REMOVE'
				}),
				unregisterBundle: mockRNDBUnregisterBundle
			}));
			const mockRNFSExists = jest.fn(() => true);
			const mockRNFSUnlink = jest.fn();
			jest.mock('react-native-fs', () => ({
				exists: mockRNFSExists,
				unlink: mockRNFSUnlink,
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.removeStaleBundles('1.0.1');

			expect(mockRNDBUnregisterBundle).toHaveBeenCalledWith('1.0.0');
			expect(mockRNFSExists).toHaveBeenCalledWith('ANY_PATH/bundles/1.0.0');
			expect(mockRNFSUnlink).toHaveBeenCalledWith('ANY_PATH/bundles/1.0.0');
		});

		it('should remove bundles if bundle version is greater or equal than package.json version', async () => {
			const mockRNDBUnregisterBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getBundles: () => ({
					'1.0.0': 'PATH_TO_REMOVE'
				}),
				unregisterBundle: mockRNDBUnregisterBundle
			}));
			const mockRNFSExists = jest.fn(() => true);
			const mockRNFSUnlink = jest.fn();
			jest.mock('react-native-fs', () => ({
				exists: mockRNFSExists,
				unlink: mockRNFSUnlink,
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.removeStaleBundles('1.0.0');

			expect(mockRNDBUnregisterBundle).not.toHaveBeenCalled();
			expect(mockRNFSExists).not.toHaveBeenCalled();
			expect(mockRNFSUnlink).not.toHaveBeenCalled();
		});
	});

	describe('reset()', () => {
		it('should remove all downloaded bundles and reset active bundle to the one from app store', async () => {
			const mockRNDBUnregisterBundle = jest.fn();
			const mockRNDBSetActiveBundle = jest.fn();
			const mockRNDBReloadBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getBundles: () => ({
					'1.0.0': 'PATH_TO_REMOVE'
				}),
				unregisterBundle: mockRNDBUnregisterBundle,
				setActiveBundle: mockRNDBSetActiveBundle,
				reloadBundle: mockRNDBReloadBundle
			}));
			const mockRNFSExists = jest.fn(() => true);
			const mockRNFSUnlink = jest.fn();
			jest.mock('react-native-fs', () => ({
				exists: mockRNFSExists,
				unlink: mockRNFSUnlink,
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.reset();

			expect(mockRNDBUnregisterBundle).toHaveBeenCalledWith('1.0.0');
			expect(mockRNFSExists).toHaveBeenCalledWith('ANY_PATH/bundles/1.0.0');
			expect(mockRNFSUnlink).toHaveBeenCalledWith('ANY_PATH/bundles/1.0.0');
			expect(mockRNDBSetActiveBundle).toHaveBeenCalledWith(null);
			expect(mockRNDBReloadBundle).toHaveBeenCalled();
		});
	});
});
