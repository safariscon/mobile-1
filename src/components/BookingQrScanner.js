import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Feather from '@expo/vector-icons/Feather';
import { lightColors } from '../theme/colors';
import useThemedStyles from '../theme/useThemedStyles';

let colors = lightColors;
let styles;

export default function BookingQrScanner({ visible, title = 'Scan booking QR', onClose, onScan }) {
  const themed = useThemedStyles(createStyles);
  colors = themed.colors;
  styles = themed.styles;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) setScanned(false);
  }, [visible]);

  const close = () => {
    setScanned(false);
    onClose?.();
  };

  const handleBarcodeScanned = ({ data }) => {
    if (scanned || !data) return;
    setScanned(true);
    onScan?.(String(data));
    close();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={close} activeOpacity={0.84}>
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>Loading camera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.messageBox}>
            <Feather name="camera" size={34} color={colors.primary} />
            <Text style={styles.messageTitle}>Camera permission needed</Text>
            <Text style={styles.messageText}>Allow camera to scan the guest booking pass.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={requestPermission} activeOpacity={0.84}>
              <Text style={styles.primaryButtonText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.scanFrame}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
            <View style={styles.scanHint}>
              <Feather name="maximize" size={16} color={colors.white} />
              <Text style={styles.scanHintText}>Align the QR in the frame</Text>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const cornerBase = {
  borderColor: colors.white,
  height: 34,
  position: 'absolute',
  width: 34,
};

const createStyles = (colors) => StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  title: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '900', marginRight: 12 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  messageBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    margin: 18,
    padding: 18,
  },
  messageTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  messageText: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 6,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  cameraWrap: { backgroundColor: '#000', flex: 1, overflow: 'hidden' },
  camera: { flex: 1 },
  scanFrame: {
    height: 236,
    left: '50%',
    marginLeft: -118,
    marginTop: -118,
    position: 'absolute',
    top: '50%',
    width: 236,
  },
  cornerTopLeft: { ...cornerBase, borderLeftWidth: 4, borderTopWidth: 4, left: 0, top: 0 },
  cornerTopRight: { ...cornerBase, borderRightWidth: 4, borderTopWidth: 4, right: 0, top: 0 },
  cornerBottomLeft: { ...cornerBase, borderBottomWidth: 4, borderLeftWidth: 4, bottom: 0, left: 0 },
  cornerBottomRight: { ...cornerBase, borderBottomWidth: 4, borderRightWidth: 4, bottom: 0, right: 0 },
  scanHint: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.76)',
    borderRadius: 999,
    bottom: 46,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    position: 'absolute',
  },
  scanHintText: { color: colors.white, fontSize: 12, fontWeight: '900' },
});
