module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 delegates its worklet transform to react-native-worklets.
    // This plugin must stay last in the list.
    plugins: ['react-native-worklets/plugin'],
  };
};
