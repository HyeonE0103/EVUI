<template>
  <div class="ev-menu-list">
    <ul class="ev-menu-ul">
      <li
        v-for="(item, idx) in items"
        v-show="!item.hidden"
        :key="`${item.value}_${idx}`"
        class="ev-menu-li"
        :class="{ disabled: item.disabled, [item.itemClass]: item.itemClass }"
        @click="handleItemClick(item)"
        @mouseenter="mouseenterLi($event, item)"
      >
        <i
          v-if="!!item.iconClass"
          class="ev-menu-li-prefix"
          :class="item.iconClass"
        />
        {{ item.text }}
        <i
          v-if="item.children || item.isShowMenu"
          class="ev-menu-li-suffix ev-icon-arrow-right2"
        />
      </li>
    </ul>
    <template v-if="isExistChild">
      <component
        :is="comp"
        v-show="childrenItems.length && isShowChild"
        ref="childMenu"
        v-model:isShow="computedIsShow"
        :comp="comp"
        :items="childrenItems"
        :style="menuStyle"
      />
    </template>
  </div>
</template>

<script>
import { useMenuList } from './uses';

export default {
  name: 'EvMenuList',
  props: {
    isShow: {
      type: Boolean,
      default: false,
    },
    items: {
      type: Array,
      default: () => [],
      validator: (list) => {
        if (list.some(v => v.children !== undefined && !Array.isArray(v.children))) {
          console.warn('[EVUI][ContextMenu] children attribute must be \'Array\' type.');
          return false;
        } else if (list.some(v => v.click !== undefined && typeof v.click !== 'function')) {
          console.warn('[EVUI][ContextMenu] click attribute must be \'Function\' type.');
          return false;
        }
        return true;
      },
    },
    comp: {
      type: Object,
      default: () => {},
    },
  },
  emits: {
    'update:isShow': [Boolean],
  },
  setup() {
    const {
      isExistChild,
      computedIsShow,
      isShowChild,
      childMenu,
      menuStyle,
      childrenItems,

      handleItemClick,
      mouseenterLi,
      hideAll,
    } = useMenuList();

    return {
      isExistChild,
      computedIsShow,
      isShowChild,
      childMenu,
      menuStyle,
      childrenItems,

      handleItemClick,
      mouseenterLi,
      hideAll,
    };
  },
};
</script>

<style lang="scss">
@import '../../style/index.scss';

.ev-menu-list {
  position: absolute;
  width: 0;
  height: 0;
  white-space: nowrap;
}

.ev-menu-ul {
  list-style: none;
  position: absolute;
  border: 1px solid #D0D0D0;
  background-color: #EEEEEE;
  z-index: 100;
}

.ev-menu-li {
  height: 30px;
  line-height: 30px;
  padding: 2px 25px;
  i {
    height: 30px;
    line-height: 30px;
  }

  &:not(:last-child) {
    border-bottom: 1px dotted #D0D0D0;
  }

  &:hover {
    background-color: #ECF5FF;
    cursor: pointer;
  }

  &.disabled {
    color: #B2B2B2;
  }

  &.disabled:hover {
    cursor: not-allowed;
  }
}

.ev-menu-li-suffix {
  position: absolute;
  right: 3px;
}

.ev-menu-li-prefix {
  position: absolute;
  left: 3px;
}
</style>
