let RNHotPatching = require('./index');

// default mocks
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

describe('React Native Hot Patching: Functional', () => {

	beforeEach(() => {
		jest.resetModules();
	});

	describe('getCurrentAppVersion()', () => {
		it('should return bundle version if it is greater than package.json version using semver compare not JS string compare', async () => {
			jest.mock('react-native-dynamic-bundle', () => ({
				getActiveBundle: () => '1.0.10'
			}));
			RNHotPatching = require('./index');
			const result = await RNHotPatching.getCurrentAppVersion('1.0.9');
            expect(result).toEqual('1.0.10');
		});
	});

	describe('removeStaleBundles()', () => {
		it('should remove stale bundles if bundle version is less than package.json version using semver compare not JS string compare', async () => {
			const mockRNDBUnregisterBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getBundles: () => ({
					'1.0.9': 'PATH_TO_REMOVE'
				}),
				unregisterBundle: mockRNDBUnregisterBundle
			}));
			jest.mock('react-native-fs', () => ({
				exists: jest.fn(() => true),
				unlink: jest.fn(),
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.removeStaleBundles('1.0.10');

			expect(mockRNDBUnregisterBundle).toHaveBeenCalledWith('1.0.9');
		});

		it('should not remove stale bundles if bundle version is greater or equal than package.json version using semver compare not JS string compare', async () => {
			const mockRNDBUnregisterBundle = jest.fn();
			jest.mock('react-native-dynamic-bundle', () => ({
				getBundles: () => ({
					'1.0.10': 'PATH_TO_REMOVE'
				}),
				unregisterBundle: mockRNDBUnregisterBundle
			}));
			jest.mock('react-native-fs', () => ({
				exists: jest.fn(() => true),
				unlink: jest.fn(),
				DocumentDirectoryPath: 'ANY_PATH'
			}));
			RNHotPatching = require('./index');

			await RNHotPatching.removeStaleBundles('1.0.9');

			expect(mockRNDBUnregisterBundle).not.toHaveBeenCalledWith();
		});
	});
});
