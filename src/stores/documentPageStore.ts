import { defineStore, acceptHMRUpdate } from 'pinia';
import type { IDocTool } from 'src/models/docPage';


export const useDocPageStore = defineStore('docPage', {
  state: () => ({
    mainTools: [] as IDocTool[],
    subTools: [] as IDocTool[],
  }),

  getters: {
    // doubleCount: (state) => state.counter * 2,
  },

  actions: {
    // increment() {
    //   this.counter++;
    // },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDocPageStore, import.meta.hot));
}
