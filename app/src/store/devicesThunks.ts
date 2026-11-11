// This is conceptually an extension of devicesSlice, but has been separated to remove circular module dependencies between deviceSlice and other slices that import from it

import {
  getDefinitionsFromStore,
  getSupportedIdsFromStore,
  syncStore,
} from '../utils/device-store';
import {getRecognisedDevices, getVendorProductId} from '../utils/hid-keyboards';
import {KeyboardAPI} from '../utils/keyboard-api';
import type {AppThunk} from './index';
import {
  reloadDefinitions,
  loadLayoutOptions,
  updateDefinitions,
  getDefinitions,
  getSelectedDefinition,
  loadStoredCustomDefinitions,
} from './definitionsSlice';
import {isVIADefinitionV2, isVIADefinitionV3} from '@the-via/reader';
import {loadKeymapFromDevice} from './keymapSlice';
import {updateLightingData} from './lightingSlice';
import {loadMacros} from './macrosSlice';
import {updateV3MenuData} from './menusSlice';
import {
  clearAllDevices,
  getConnectedDevices,
  getForceAuthorize,
  getSelectedDevicePath,
  getSupportedIds,
  selectDevice,
  markDeviceReady,
  setForceAuthorize,
  updateConnectedDevices,
  updateInvalidProtocolDevices,
  updateUnresolvedDefinitionDevices,
  updateSupportedIds,
} from './devicesSlice';
import {HID} from 'src/shims/node-hid';
import type {
  KeyboardDictionary,
  VIADefinitionV2,
  VIADefinitionV3,
} from '@the-via/reader';
import type {
  AuthorizedDevice,
  AuthorizedDevices,
  ConnectedDevice,
  ConnectedDevices,
  Device,
  WebVIADevice,
} from 'src/types/types';
import {createRetry} from 'src/utils/retry';
import {extractDeviceInfo, logAppError} from './errorsSlice';
import {loadFirmwareVersion, loadKeycodesVersion} from './firmwareSlice';
import {loadDefinitionName} from './definitionNameSlice';
import {KeycodesVersionProtocolError} from 'src/utils/keycodes-version';

const selectConnectedDeviceRetry = createRetry(8, 100);

export const selectConnectedDeviceByPath =
  (path: string): AppThunk =>
  async (dispatch, getState) => {
    // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
    await dispatch(reloadConnectedDevices());
    const connectedDevice = getConnectedDevices(getState())[path];
    if (connectedDevice) {
      dispatch(selectConnectedDevice(connectedDevice));
    }
  };

// TODO: should we change these other thunks to use the selected device state instead of params?
// Maybe not? the nice this about this is we don't have to null check the device
const selectConnectedDevice =
  (connectedDevice: ConnectedDevice): AppThunk =>
  async (dispatch, getState) => {
    const deviceInfo = extractDeviceInfo(connectedDevice);
    try {
      await dispatch(loadKeycodesVersion(connectedDevice));
      dispatch(selectDevice(connectedDevice));
      // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
      await dispatch(loadMacros(connectedDevice));
      await dispatch(loadLayoutOptions());

      // Branch on the definition we actually resolved, not just on firmware
      // protocol: a v2 definition on modern firmware must still use the v2
      // lighting path, and a v3 definition on an older board must not be sent
      // through v3 menu commands.
      const definition = getSelectedDefinition(getState());
      try {
        if (isVIADefinitionV2(definition)) {
          await dispatch(updateLightingData(connectedDevice));
        } else if (isVIADefinitionV3(definition)) {
          await dispatch(loadDefinitionName(connectedDevice));
          await dispatch(loadFirmwareVersion(connectedDevice));
          await dispatch(updateV3MenuData(connectedDevice));
        }
      } catch (e) {
        dispatch(
          logAppError({
            message: 'Loading lighting/menu data failed',
            deviceInfo,
          }),
        );
      }

      // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
      await dispatch(loadKeymapFromDevice(connectedDevice));
      dispatch(markDeviceReady(connectedDevice.path));
      selectConnectedDeviceRetry.clear();
    } catch (e) {
      if (e instanceof KeycodesVersionProtocolError) {
        selectConnectedDeviceRetry.clear();
        return;
      }
      if (selectConnectedDeviceRetry.retriesLeft()) {
        dispatch(
          logAppError({
            message: 'Loading device failed - retrying',
            deviceInfo,
          }),
        );
        selectConnectedDeviceRetry.retry(() => {
          dispatch(selectConnectedDevice(connectedDevice));
        });
      } else {
        dispatch(
          logAppError({
            message: 'All retries failed for attempting connection with device',
            deviceInfo,
          }),
        );
        console.log('Hard resetting device store:', e);
        dispatch(clearAllDevices());
      }
    }
  };

/**
 * Pick the definition a device can actually use. Firmware protocol suggests a
 * generation, but a board may only ship the other one; recognition must never
 * require the user to toggle a compatibility switch.
 */
const resolveDefinitionForDevice = (
  device: AuthorizedDevice,
  definitions: KeyboardDictionary,
): {version: 'v2' | 'v3'; definition: VIADefinitionV2 | VIADefinitionV3} | null => {
  const entry = definitions[device.vendorProductId];
  if (!entry) {
    return null;
  }
  const preferred = device.requiredDefinitionVersion;
  if (entry[preferred]) {
    return {version: preferred, definition: entry[preferred]};
  }
  const fallback: 'v2' | 'v3' = preferred === 'v3' ? 'v2' : 'v3';
  if (entry[fallback]) {
    return {version: fallback, definition: entry[fallback]};
  }
  return null;
};

// This scans for potentially compatible devices, filter out the ones that have the correct protocol
// and then optionally will select the first one if the current selection is non-existent
export const reloadConnectedDevices =
  (options?: {allowUnsupported?: boolean}): AppThunk => async (dispatch, getState) => {
    const state = getState();
    const selectedDevicePath = getSelectedDevicePath(state);
    const allowUnsupported =
      options?.allowUnsupported || getForceAuthorize(state);

    // TODO: should we store in local storage for when offline?
    // Might be worth looking at whole store to work out which bits to store locally
    const supportedIds = getSupportedIds(state);

    const recognisedDevices = await getRecognisedDevices(
      supportedIds,
      allowUnsupported,
    );

    const protocolVersions = await Promise.all(
      recognisedDevices.map((device) =>
        new KeyboardAPI(device.path).getProtocolVersion(),
      ),
    );

    const recognisedDevicesWithBadProtocol = recognisedDevices.filter(
      (_, i) => protocolVersions[i] === -1,
    );

    if (recognisedDevicesWithBadProtocol.length) {
      // Should we exit early??
      recognisedDevicesWithBadProtocol.forEach((device: WebVIADevice) => {
        const deviceInfo = extractDeviceInfo(device);
        dispatch(
          logAppError({
            message: 'Received invalid protocol version from device',
            deviceInfo,
          }),
        );
      });
    }
    dispatch(
      updateInvalidProtocolDevices(
        recognisedDevicesWithBadProtocol.reduce<Record<string, Device>>(
          (devices, device) => {
            const {
              path,
              productId,
              vendorId,
              productName,
              interface: intf,
            } = device;
            devices[path] = {
              path,
              productId,
              vendorId,
              productName,
              interface: intf,
            };
            return devices;
          },
          {},
        ),
      ),
    );

    const authorizedDevices: AuthorizedDevice[] = recognisedDevices
      .filter((_, i) => protocolVersions[i] !== -1)
      .map((device, idx) => {
        const {path, productId, vendorId, productName} = device;
        const protocol = protocolVersions[idx];
        return {
          path,
          productId,
          vendorId,
          protocol,
          productName,
          hasResolvedDefinition: false,
          requiredDefinitionVersion: protocol >= 11 ? 'v3' : 'v2',
          vendorProductId: getVendorProductId(
            device.vendorId,
            device.productId,
          ),
        };
      });

    await dispatch(reloadDefinitions(authorizedDevices));

    const newDefinitions = getDefinitions(getState());
    const resolvedDevices = authorizedDevices
      .map((device) => ({
        device,
        resolved: resolveDefinitionForDevice(device, newDefinitions),
      }))
      .filter(
        (entry): entry is {
          device: AuthorizedDevice;
          resolved: {version: 'v2' | 'v3'; definition: VIADefinitionV2 | VIADefinitionV3};
        } => entry.resolved !== null,
      );

    const connectedDevices = resolvedDevices.reduce<ConnectedDevices>(
      (devices, {device, resolved}) => {
        devices[device.path] = {
          ...device,
          requiredDefinitionVersion: resolved.version,
          hasResolvedDefinition: true,
        };
        return devices;
      },
      {},
    );

    const unresolvedDefinitionDevices = authorizedDevices
      .filter((device) => !connectedDevices[device.path])
      .reduce<AuthorizedDevices>((devices, device) => {
        devices[device.path] = device;
        return devices;
      }, {});

    dispatch(updateUnresolvedDefinitionDevices(unresolvedDefinitionDevices));

    // Keep unresolved devices authorized. Forgetting them here invalidated the
    // underlying HIDDevice while the cached wrapper was still being probed on
    // the next scan, producing "InvalidStateError: The device is forgotten"
    // and then a bogus "invalid protocol version" for a healthy keyboard.

    const validDevicesArr = Object.entries(connectedDevices);
    validDevicesArr.forEach(([path, d]) => {
      console.info('Setting connected device:', d.protocol, path, d);
    });
    dispatch(updateConnectedDevices(connectedDevices));

    // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
    // If we haven't chosen a selected device yet and there is a valid device, try that
    if (
      (!selectedDevicePath || !connectedDevices[selectedDevicePath]) &&
      validDevicesArr.length > 0
    ) {
      const firstConnectedDevice = validDevicesArr[0][1];

      dispatch(selectConnectedDevice(firstConnectedDevice));
    } else if (validDevicesArr.length === 0) {
      // Do not arm an automatic permission prompt here. The previous build
      // flipped forceAuthorize on, which made every rescan pop the HID
      // chooser and left the UI stuck on "searching for devices". Manual
      // selection is an explicit user action.
      dispatch(selectDevice(null));
    }
  };

/**
 * Explicit "choose keyboard" action. Opens the WebHID chooser (Electron has a
 * custom picker), then rescans with unsupported devices allowed so a board
 * without a bundled definition still shows up with a useful message.
 */
export const requestDeviceFromUser =
  (options?: {showAll?: boolean}): AppThunk => async (dispatch) => {
    let requested: WebVIADevice | undefined;
    try {
      requested = await HID.requestDevice(options?.showAll !== false);
    } catch (error) {
      console.warn('HID request cancelled or failed', error);
      return;
    }
    if (!requested) {
      return;
    }
    // A manually picked device may not expose the VIA raw-HID collection.
    // Probe it directly so the user gets the "not a VIA keyboard" dialog
    // instead of a silent no-op (the normal scan filters such devices out).
    // Bound the probe: some non-VIA HID devices accept the report but never
    // send a reply, which would otherwise leave this action pending forever.
    let protocol = -1;
    try {
      protocol = await Promise.race([
        new KeyboardAPI(requested.path).getProtocolVersion(),
        new Promise<number>((resolve) => setTimeout(() => resolve(-1), 2500)),
      ]);
    } catch {
      protocol = -1;
    }
    if (protocol === -1) {
      dispatch(
        updateInvalidProtocolDevices({
          [requested.path]: {
            path: requested.path,
            vendorId: requested.vendorId,
            productId: requested.productId,
            productName: requested.productName,
            interface: requested.interface,
          },
        }),
      );
      return;
    }
    dispatch(setForceAuthorize(true));
    try {
      await dispatch(reloadConnectedDevices({allowUnsupported: true}));
    } finally {
      dispatch(setForceAuthorize(false));
    }
  };

export const loadSupportedIds = (): AppThunk => async (dispatch) => {
  await syncStore();
  dispatch(updateSupportedIds(getSupportedIdsFromStore()));
  // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
  await dispatch(updateDefinitions(getDefinitionsFromStore()));
  dispatch(loadStoredCustomDefinitions());
  dispatch(reloadConnectedDevices());
};
