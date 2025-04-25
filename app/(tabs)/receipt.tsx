import React, { useState, useEffect } from 'react';
import { StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert, Platform, ScrollView, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ThemedText as Text } from '@/components/ThemedText';
import { ThemedView as View } from '@/components/ThemedView';
import { useAuthContext } from '@/app/contexts/AuthContext';
import * as api from '@/app/services/api';

// Define types for our receipt data
interface Restaurant {
  restaurant?: string;
  address?: string;
  ordered_time?: string;
  checkout_time?: string;
  guest_count?: number;
}

interface Item {
  name: string;
  quantity: number;
  total: number;
}

interface Payment {
  subtotal: number;
  tax?: number;
  tip?: number;
  total: number;
  currency?: string;
}

interface ReceiptData {
  meta_data?: Restaurant;
  items?: Item[];
  payment?: Payment;
  success: boolean;
  error?: string;
}

interface SaveReceiptResponse {
  id: string;
  success: boolean;
  error?: string;
}

interface LoadReceiptResponse {
  documentId: string;
  shareData?: any;
  processedData?: any;
  success: boolean;
  error?: string;
}

interface UpdateReceiptResponse {
  id: string;
  success: boolean;
  message?: string;
  error?: string;
}

export default function ReceiptScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ReceiptData | null>(null);
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);
  const [receiptIdInput, setReceiptIdInput] = useState('');
  const { user } = useAuthContext();

  // Pick an image from the gallery
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library to upload receipts');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setResult(null); // Reset previous results
      setSavedReceiptId(null); // Reset saved receipt ID
    }
  };

  // Take a photo with the camera
  const takePhoto = async () => {
    // Request both camera and media library permissions
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (cameraPermission.status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your camera to take receipt photos');
      return;
    }

    try {
      // Launch camera directly
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        setResult(null); // Reset previous results
        setSavedReceiptId(null); // Reset saved receipt ID
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Camera Error', 'There was a problem accessing your camera. Please try using the gallery option instead.');
    }
  };

  // Process the receipt using Firebase function
  const processReceipt = async () => {
    if (!image) {
      Alert.alert('No image', 'Please select or take a receipt photo first');
      return;
    }

    setLoading(true);
    
    try {
      // Read the image as base64
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64data = reader.result?.toString().split(',')[1] || '';
          
          // Send the base64 image to the function
          sendImageToFunction(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error processing receipt:', error);
      Alert.alert('Error', 'Failed to process receipt. Please try again.');
      setLoading(false);
    }
  };

  // Send the base64 image to the Firebase function
  const sendImageToFunction = async (base64Image: string) => {
    try {
      // Call the Firebase function with the authenticated API
      const data = await api.processReceipt(base64Image);
      
      if (data.success) {
        setResult(data);
      } else {
        Alert.alert('Error', data.error || 'Failed to process receipt');
      }
    } catch (error) {
      console.error('Error sending to function:', error);
      Alert.alert('Error', 'Failed to process receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Save the processed receipt data to the database
  const saveReceipt = async () => {
    if (!result) {
      Alert.alert('No data', 'Please process a receipt first before saving');
      return;
    }

    setSaving(true);

    try {
      // Prepare the data to save
      const receiptData = {
        originalData: {
          imageUri: image,
          timestamp: new Date().toISOString(),
        },
        processedData: {
          meta_data: result.meta_data,
          items: result.items,
          payment: result.payment,
        },
        processingMetadata: {
          processedAt: new Date().toISOString(),
          source: 'mobile_app',
          platform: Platform.OS,
        }
      };

      // Call the save receipt endpoint
      const response = await api.saveReceipt(receiptData);
      
      if (response.success) {
        setSavedReceiptId(response.id);
        Alert.alert('Success', `Receipt saved with ID: ${response.id}`);
      } else {
        Alert.alert('Error', response.error || 'Failed to save receipt');
      }
    } catch (error) {
      console.error('Error saving receipt:', error);
      Alert.alert('Error', 'Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Load a receipt by ID
  const loadReceipt = async (id: string) => {
    if (!id) {
      Alert.alert('No ID', 'Please enter a receipt ID to load');
      return;
    }

    setLoading(true);

    try {
      // Call the load receipt endpoint
      const data = await api.loadReceiptById(id);
      
      if (data.success) {
        // Reset current state
        setImage(null);
        
        // Set the loaded data
        if (data.processedData) {
          setResult({
            meta_data: data.processedData.meta_data,
            items: data.processedData.items,
            payment: data.processedData.payment,
            success: true
          });
          setSavedReceiptId(id);
        } else {
          Alert.alert('Warning', 'Receipt loaded but no processed data found');
        }
      } else {
        Alert.alert('Error', data.error || 'Failed to load receipt');
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
      Alert.alert('Error', 'Failed to load receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Update a receipt
  const updateReceipt = async (id: string, updateData: any) => {
    if (!id) {
      Alert.alert('No ID', 'Please enter a receipt ID to update');
      return;
    }

    setSaving(true);

    try {
      // Call the update receipt endpoint
      const response = await api.updateReceiptById(id, updateData);
      
      if (response.success) {
        Alert.alert('Success', `Receipt updated with ID: ${response.id}`);
      } else {
        Alert.alert('Error', response.error || 'Failed to update receipt');
      }
    } catch (error) {
      console.error('Error updating receipt:', error);
      Alert.alert('Error', 'Failed to update receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Load a receipt by ID from user input
  const handleLoadReceipt = () => {
    if (receiptIdInput) {
      loadReceipt(receiptIdInput);
    } else {
      Alert.alert('Missing ID', 'Please enter a receipt ID to load');
    }
  };

  // Clear the current receipt state
  const clearReceipt = () => {
    setImage(null);
    setResult(null);
    setSavedReceiptId(null);
    setReceiptIdInput('');
  };

  // Render the result section
  const renderResult = () => {
    if (!result) return null;
    
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.sectionTitle}>Receipt Data</Text>
        
        {/* Restaurant info */}
        {result.meta_data && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Restaurant Information</Text>
            {result.meta_data.restaurant && (
              <Text style={styles.resultText}>Restaurant: {result.meta_data.restaurant}</Text>
            )}
            {result.meta_data.address && (
              <Text style={styles.resultText}>Address: {result.meta_data.address}</Text>
            )}
            {result.meta_data.ordered_time && (
              <Text style={styles.resultText}>Order Time: {result.meta_data.ordered_time}</Text>
            )}
            {result.meta_data.checkout_time && (
              <Text style={styles.resultText}>Checkout Time: {result.meta_data.checkout_time}</Text>
            )}
            {result.meta_data.guest_count && (
              <Text style={styles.resultText}>Guest Count: {result.meta_data.guest_count}</Text>
            )}
          </View>
        )}
        
        {/* Items */}
        {result.items && result.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Items</Text>
            {result.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQuantity}>x{item.quantity || 0}</Text>
                <Text style={styles.itemPrice}>${(item.total != null) ? item.total.toFixed(2) : '0.00'}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* Payment info */}
        {result.payment && (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Payment</Text>
            <Text style={styles.resultText}>
              Subtotal: ${(result.payment.subtotal != null) ? result.payment.subtotal.toFixed(2) : '0.00'}
            </Text>
            {result.payment.tax != null && (
              <Text style={styles.resultText}>
                Tax: ${result.payment.tax.toFixed(2)}
              </Text>
            )}
            {result.payment.tip != null && (
              <Text style={styles.resultText}>
                Tip: ${result.payment.tip.toFixed(2)}
              </Text>
            )}
            <Text style={styles.resultText}>
              Total: ${(result.payment.total != null) ? result.payment.total.toFixed(2) : '0.00'}
            </Text>
            {result.payment.currency && (
              <Text style={styles.resultText}>Currency: {result.payment.currency}</Text>
            )}
          </View>
        )}
        
        {/* Actions for the receipt */}
        <View style={styles.actionButtons}>
          {!savedReceiptId && (
            <TouchableOpacity 
              style={[styles.button, styles.saveButton]} 
              onPress={saveReceipt}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save Receipt</Text>
              )}
            </TouchableOpacity>
          )}
          
          {savedReceiptId && (
            <View style={styles.savedInfo}>
              <Text style={styles.savedText}>Saved Receipt ID: {savedReceiptId}</Text>
              <TouchableOpacity 
                style={[styles.button, styles.updateButton]} 
                onPress={() => updateReceipt(savedReceiptId, {
                  processedData: {
                    meta_data: result.meta_data,
                    items: result.items,
                    payment: result.payment,
                  }
                })}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Update Receipt</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // User ID display
  const renderUserInfo = () => {
    if (!user) return null;
    
    return (
      <View style={styles.userInfo}>
        <Text style={styles.userText}>
          {user.isAnonymous ? 'Anonymous User' : 'User'}: {user.uid.substring(0, 8)}...
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {renderUserInfo()}
      
      <View style={styles.header}>
        <Text style={styles.title}>Receipt Scanner</Text>
      </View>
      
      <View style={styles.imageContainer}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity style={styles.clearButton} onPress={clearReceipt}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderText}>No image selected</Text>
          </View>
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Select Image</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.processButton]} 
          onPress={processReceipt} 
          disabled={!image || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Process Receipt</Text>
          )}
        </TouchableOpacity>
      </View>
      
      <View style={styles.loadReceiptContainer}>
        <Text style={styles.sectionTitle}>Load Existing Receipt</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={receiptIdInput}
            onChangeText={setReceiptIdInput}
            placeholder="Enter Receipt ID"
            placeholderTextColor="#999"
          />
          <TouchableOpacity 
            style={[styles.button, styles.loadButton]} 
            onPress={handleLoadReceipt}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Load</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {renderResult()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  userInfo: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 8,
  },
  userText: {
    fontSize: 12,
    opacity: 0.7,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 40,
  },
  imageContainer: {
    position: 'relative',
    height: 200,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e0e0e0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#888',
  },
  clearButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 8,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  processButton: {
    backgroundColor: '#4CAF50',
  },
  saveButton: {
    backgroundColor: '#FF9800',
  },
  updateButton: {
    backgroundColor: '#9C27B0',
  },
  loadButton: {
    flex: 0.3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  loadReceiptContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: 'white',
  },
  resultContainer: {
    marginTop: 20,
  },
  section: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#555',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    flex: 3,
    fontSize: 14,
  },
  itemQuantity: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  itemPrice: {
    flex: 1,
    fontSize: 14,
    textAlign: 'right',
  },
  actionButtons: {
    marginTop: 10,
  },
  savedInfo: {
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    marginBottom: 10,
  },
  savedText: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
}); 