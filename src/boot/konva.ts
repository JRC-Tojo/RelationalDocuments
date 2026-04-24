import { defineBoot } from '#q-app/wrappers';
import VueKonva from 'vue-konva';

// "async" is optional;
// more info on params: https://v2.quasar.dev/quasar-cli-vite/boot-files
export default defineBoot(({ app }) => {
  // something to do
  app.use(VueKonva);
});
