import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Navbar from "../../components/Navbar";
import Loader from "../../components/Loader";
import { Plus, Folder } from "lucide-react-native";
import { router } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
  
interface ActionButtonProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, title, onClick }) => {
  const { isDark } = useTheme();
  
  return (
    <TouchableOpacity onPress={onClick} style={[styles.button, { backgroundColor: isDark ? '#E8E5D8' : '#3A3A3A' }]}>
      <View style={styles.buttonInner}>
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={[styles.buttonText, { color: isDark ? '#1A1A1A' : '#FFFFFF' }]}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

const Home: React.FC = () => {
  const { colors, isDark } = useTheme();

  // ===================== NAVIGATE TO CANVAS =====================
  // User will create project in canvas.tsx after providing inputs
  const handleNewProject = () => {
    router.push('/(app)/canvas');
  };


  // ===================== BUTTONS =====================
  const actionButtons = [
    {
      icon: <Plus size={48} strokeWidth={2.5} color={isDark ? '#1A1A1A' : '#FFFFFF'} />,
      title: "NEW\nPROJECT",
      onClick: handleNewProject,
    },
    {
      icon: <Folder size={48} strokeWidth={2.5} color={isDark ? '#1A1A1A' : '#FFFFFF'} />,
      title: "PROJECT\nGALLERY",
      onClick: () => router.push("/(app)/projects"),
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#1A1A1A' : '#E8E5D8' }]}>
      <Navbar screenName="HOME" />

      <View style={styles.mainContainer}>
        {actionButtons.map((button, index) => (
          <ActionButton
            key={index}
            icon={button.icon}
            title={button.title}
            onClick={button.onClick}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  mainContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 32,
  },

  button: {
    width: 280,
    height: 149,
    borderRadius: 28,
    justifyContent: "center",
    paddingLeft: 37,
    marginBottom: 40,
  },

  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 64,
    height: 64,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  buttonText: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: "DelaGothicOne",
    fontWeight: "bold",
  },
});