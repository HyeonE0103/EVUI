import { getCurrentInstance, nextTick } from 'vue';
import { uniqBy } from 'lodash-es';
import { numberWithComma } from '@/common/utils';

const ROW_INDEX = 0;
const ROW_CHECK_INDEX = 1;
const ROW_DATA_INDEX = 2;
const ROW_SELECT_INDEX = 3;
const ROW_EXPAND_INDEX = 4;

export const commonFunctions = () => {
  const { props } = getCurrentInstance();
  /**
   * 해당 컬럼이 사용자 지정 컬럼인지 확인한다.
   *
   * @param {object} column - 컬럼 정보
   * @returns {boolean} 사용자 지정 컬럼 유무
   */
  const isRenderer = (column = {}) => !!column?.render?.use;
  const getComponentName = (type = '') => {
    const setUpperCaseFirstStr = str => str.charAt(0).toUpperCase() + str.slice(1);
    const rendererStr = 'Renderer';
    let typeStr = '';
    if (type.indexOf('_') !== -1) {
      const typeStrArray = type.split('_');
      for (let ix = 0; ix < typeStrArray.length; ix++) {
        typeStr += setUpperCaseFirstStr(typeStrArray[ix]);
      }
    } else {
      typeStr = setUpperCaseFirstStr(type);
    }
    return typeStr + rendererStr;
  };
  /**
   * 데이터 타입에 따라 변환된 데이터을 반환한다.
   *
   * @param {object} column - 컬럼 정보
   * @param {number|string} value - 데이터
   * @returns {number|string} 변환된 데이터
   */
  const getConvertValue = (column, value) => {
    let convertValue = column.type === 'number' || column.type === 'float' ? Number(value) : value;

    if (column.type === 'number') {
      convertValue = numberWithComma(value);
      convertValue = convertValue === false ? value : convertValue;
    } else if (column.type === 'float') {
      const floatValue = convertValue.toFixed(column.decimal ?? 3);
      convertValue = floatValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    return convertValue;
  };
  /**
   * 전달받은 필드명과 일치하는 컬럼 인덱스를 반환한다.
   *
   * @param {string} field - 컬럼 필드명
   * @returns {number} 일치한다면 컬럼 인덱스, 일치하지 않는다면 -1
   */
  const getColumnIndex = field => props.columns.findIndex(column => column.field === field);
  const setPixelUnit = (value) => {
    let size = value;
    const hasPx = size.toString().indexOf('px') >= 0;
    const hasPct = size.toString().indexOf('%') >= 0;
    if (!hasPx && !hasPct) {
      size = `${size}px`;
    }
    return size;
  };

  return {
    isRenderer,
    getComponentName,
    getConvertValue,
    getColumnIndex,
    setPixelUnit,
  };
};

export const getUpdatedColumns = (stores) => {
  if (stores.movedColumns?.length) {
    const orderedColumnsIndexes = stores.orderedColumns?.map(column => column.index);
    const extraColumns = stores.originColumns?.filter(
      column => !orderedColumnsIndexes.includes(column.index),
    );
    const copyOrderedColumns = stores.orderedColumns;
    return [...copyOrderedColumns, ...extraColumns];
  }
  const { originColumns, filteredColumns } = stores;
  return originColumns.map((col) => {
    const changedCol = filteredColumns.find(fcol => fcol.index === col.index) ?? {};
    return {
      ...col,
      ...changedCol,
    };
  });
};

export const scrollEvent = (params) => {
  const {
    scrollInfo,
    stores,
    elementInfo,
    resizeInfo,
    pageInfo,
    summaryScroll,
    getPagingData,
    updatePagingInfo,
    expandedInfo,
  } = params;
  /**
   * 수직 스크롤의 위치 계산 후 적용한다.
   */
  const updateVScrollBase = (isScroll) => {
    const bodyEl = elementInfo.body;
    const rowHeight = resizeInfo.rowHeight;
    if (bodyEl) {
      let store = stores.store;
      if (pageInfo.isClientPaging) {
        store = getPagingData();
      }
      const rowCount = bodyEl.clientHeight > rowHeight
        ? Math.ceil(bodyEl.clientHeight / rowHeight) : store.length;
      const totalScrollHeight = store.length * rowHeight;
      let firstVisibleIndex = Math.floor(bodyEl.scrollTop / rowHeight);
      if (firstVisibleIndex > store.length - 1) {
        firstVisibleIndex = 0;
      }

      const lastVisibleIndex = firstVisibleIndex + rowCount + 1;
      const firstIndex = Math.max(firstVisibleIndex, 0);
      const lastIndex = lastVisibleIndex;
      const tableEl = elementInfo.table;

      stores.viewStore = store.slice(firstIndex, lastIndex);
      scrollInfo.hasVerticalScrollBar = rowCount < store.length
        || bodyEl.clientHeight < tableEl.clientHeight;
      scrollInfo.vScrollTopHeight = firstIndex * rowHeight;
      scrollInfo.vScrollBottomHeight = totalScrollHeight - (stores.viewStore.length * rowHeight)
        - scrollInfo.vScrollTopHeight;
      if (isScroll && pageInfo.isInfinite && scrollInfo.vScrollBottomHeight === 0) {
        pageInfo.prevPage = pageInfo.currentPage;
        pageInfo.currentPage = Math.ceil(lastIndex / pageInfo.perPage) + 1;
        pageInfo.startIndex = lastIndex;
        updatePagingInfo({ onScrollEnd: true });
      }
    }
  };

  /**
   *  rowDetail slot 시에는 가상 스크롤을 적용하지 않는다.
   */
  const updateVScroll = (isScroll) => {
    if (expandedInfo.useRowDetail) {
      let store = stores.store;
      if (pageInfo.isClientPaging) {
        store = getPagingData();
      }
      stores.viewStore = [...store];
      scrollInfo.vScrollTopHeight = 0;
      scrollInfo.vScrollBottomHeight = 0;
    } else {
      updateVScrollBase(isScroll);
    }
  };
  /**
   * 수평 스크롤의 위치 계산 후 적용한다.
   */
  const updateHScroll = () => {
    const headerEl = elementInfo.header;
    const bodyEl = elementInfo.body;
    const tableEl = elementInfo.table;

    headerEl.scrollLeft = bodyEl.scrollLeft;
    summaryScroll.value = bodyEl.scrollLeft;
    scrollInfo.hasHorizontalScrollBar = bodyEl.clientWidth < tableEl.clientWidth;
  };
  /**
   * scroll 이벤트를 처리한다.
   */
  const onScroll = () => {
    const bodyEl = elementInfo.body;
    const scrollTop = bodyEl.scrollTop;
    const scrollLeft = bodyEl.scrollLeft;
    const lastTop = scrollInfo.lastScroll.top;
    const lastLeft = scrollInfo.lastScroll.left;
    const isHorizontal = !(scrollLeft === lastLeft);
    const isVertical = !(scrollTop === lastTop);

    if (isVertical && bodyEl?.clientHeight) {
      updateVScroll(true);
    }

    if (isHorizontal) {
      updateHScroll();
    }

    scrollInfo.lastScroll.top = scrollTop;
    scrollInfo.lastScroll.left = scrollLeft;
  };
  return { updateVScroll, updateHScroll, onScroll };
};

export const resizeEvent = (params) => {
  const { props, emit } = getCurrentInstance();
  const {
    resizeInfo,
    elementInfo,
    checkInfo,
    expandedInfo,
    stores,
    isRenderer,
    updateVScroll,
    updateHScroll,
    contextInfo,
  } = params;
  /**
   * 고정 너비, 스크롤 유무 등에 따른 컬럼 너비를 계산한다.
   */
  const calculatedColumn = () => {
    let columnWidth = resizeInfo.columnWidth;
    let remainWidth = 0;
    if (resizeInfo.adjust) {
      const bodyEl = elementInfo.body;
      let elWidth = bodyEl.offsetWidth;
      const elHeight = bodyEl.offsetHeight;
      const rowHeight = bodyEl.querySelector('tr')?.offsetHeight || resizeInfo.rowHeight;
      const scrollWidth = elWidth - bodyEl.clientWidth;

      const result = stores.orderedColumns.reduce((acc, cur) => {
        if (cur.hide || cur.hiddenDisplay) {
          return acc;
        }
        if (cur.width) {
          acc.totalWidth += cur.width;
        } else {
          acc.emptyCount++;
        }

        return acc;
      }, { totalWidth: contextInfo.customContextMenu.length ? 30 : 0, emptyCount: 0 });

      if (rowHeight * props.rows.length > elHeight) {
        elWidth -= scrollWidth;
      }

      if (checkInfo.useCheckbox.use) {
        elWidth -= resizeInfo.minWidth;
      }

      if (expandedInfo.useRowDetail) {
        elWidth -= resizeInfo.minWidth;
      }

      columnWidth = elWidth - result.totalWidth;
      if (columnWidth > 0) {
        remainWidth = columnWidth
          - (Math.floor(columnWidth / result.emptyCount) * result.emptyCount);
        columnWidth = Math.floor(columnWidth / result.emptyCount);
      } else {
        columnWidth = resizeInfo.columnWidth;
      }

      columnWidth = columnWidth < resizeInfo.minWidth ? resizeInfo.minWidth : columnWidth;
      resizeInfo.columnWidth = columnWidth;
    }

    stores.orderedColumns.forEach((column) => {
      const item = column;
      const minWidth = isRenderer(column) ? resizeInfo.rendererMinWidth : resizeInfo.minWidth;
      if (item.width && item.width < minWidth) {
        item.width = minWidth;
      }
      if (!item.width && !item.hide) {
        item.width = columnWidth;
      }
      return item;
    });

    if (remainWidth) {
      let index = stores.orderedColumns.length - 1;
      let lastColumn = stores.orderedColumns[index];
      while (lastColumn.hide) {
        index -= 1;
        lastColumn = stores.orderedColumns[index];
      }
      lastColumn.width += remainWidth;
    }
  };
  /**
   * grid resize 이벤트를 처리한다.
   */
  const onResize = () => {
    nextTick(() => {
      if (resizeInfo.adjust) {
        stores.orderedColumns.forEach((column) => {
          const item = column;

          if (!item.resized) {
            item.width = props.columns[column.index].width ?? 0;
          }

          return item;
        }, this);
      }

      calculatedColumn();
      if (elementInfo.body?.clientHeight) {
        updateVScroll();
      }
      if (elementInfo.body?.clientWidth) {
        updateHScroll();
      }
    });
  };

  const onShow = (isVisible) => {
    if (isVisible) {
      onResize();
    }
  };

  /**
   * column resize 이벤트를 처리한다.
   *
   * @param {number} columnIndex - 컬럼 인덱스
   * @param {object} event - 이벤트 객체
   */
  const onColumnResize = (columnIndex, event) => {
    event.preventDefault();
    const headerEl = elementInfo.header;
    const bodyEl = elementInfo.body;
    const headerLeft = headerEl.getBoundingClientRect().left;
    const columnEl = headerEl.querySelector(`li[data-index="${columnIndex}"]`);
    const minWidth = isRenderer(stores.orderedColumns[columnIndex])
      ? resizeInfo.rendererMinWidth : resizeInfo.minWidth;
    const columnRect = columnEl.getBoundingClientRect();
    const resizeLineEl = elementInfo.resizeLine;
    const minLeft = columnRect.left - headerLeft + minWidth;
    const startLeft = columnRect.right - headerLeft;
    const startMouseLeft = event.clientX;
    const startColumnLeft = columnRect.left - headerLeft;

    bodyEl.style.overflow = 'auto';
    resizeLineEl.style.left = `${startLeft}px`;

    resizeInfo.showResizeLine = true;

    const handleMouseMove = (evt) => {
      const deltaLeft = evt.clientX - startMouseLeft;
      const proxyLeft = startLeft + deltaLeft;
      const resizeWidth = Math.max(minLeft, proxyLeft);

      resizeLineEl.style.left = `${resizeWidth}px`;
    };

    const handleMouseUp = () => {
      const destLeft = parseInt(resizeLineEl.style.left, 10);
      const changedWidth = destLeft - startColumnLeft;

      if (stores.orderedColumns[columnIndex]) {
        stores.orderedColumns[columnIndex].width = changedWidth;
        stores.orderedColumns[columnIndex].resized = true;
      }

      resizeInfo.showResizeLine = false;
      document.removeEventListener('mousemove', handleMouseMove);
      onResize();

      const updatedColumns = getUpdatedColumns(stores);
      emit('resize-column', {
        column: stores.orderedColumns[columnIndex],
        columns: updatedColumns,
      });
      emit('change-column-info', {
        type: 'resize',
        columns: updatedColumns,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, { once: true });
  };
  return { calculatedColumn, onResize, onShow, onColumnResize };
};

export const clickEvent = (params) => {
  const { emit } = getCurrentInstance();
  const { selectInfo, stores } = params;
  const getClickedRowData = (event, row) => {
    const tagName = event.target.tagName?.toLowerCase();
    let cellInfo = {};
    if (tagName === 'td') {
      cellInfo = event.target.dataset;
    } else {
      cellInfo = event.target.parentNode.dataset;
    }
    return {
      event,
      rowData: row[ROW_DATA_INDEX],
      rowIndex: row[ROW_INDEX],
      cellName: cellInfo.name,
      cellIndex: cellInfo.index,
    };
  };
  /**
   * row click 이벤트를 처리한다.
   *
   * @param {object} event - 이벤트 객체
   * @param {array} row - row 데이터
   */
  let clickTimer = null;
  let lastIndex = -1;
  const onRowClick = (event, row, isRight) => {
    if (event.target.parentElement.classList?.contains('row-checkbox-input')) {
      return false;
    }
    const isContextmenu = !!event.target.closest('td')?.classList?.contains('row-contextmenu');
    const onMultiSelectByKey = (keyType, selected, selectedRow) => {
      if (keyType === 'shift') {
        const rowIndex = row[ROW_INDEX];
        if (lastIndex > -1) {
          for (
            let i = Math.min(rowIndex, lastIndex);
            i <= Math.max(rowIndex, lastIndex);
            i++
          ) {
            if (!selected) {
              stores.originStore[i][ROW_SELECT_INDEX] = true;
              if (lastIndex !== i) {
                selectInfo.selectedRow.push(stores.originStore[i][ROW_DATA_INDEX]);
              }
            } else {
              stores.originStore[i][ROW_SELECT_INDEX] = false;
              const deselectedIndex = selectInfo.selectedRow
                .indexOf(stores.originStore[i][ROW_DATA_INDEX]);
              if (deselectedIndex > -1) {
                selectInfo.selectedRow.splice(deselectedIndex, 1);
              }
            }
          }
        }
      } else if (keyType === 'ctrl') {
        if (!selected) {
          selectInfo.selectedRow.push(selectedRow);
        } else {
          selectInfo.selectedRow.splice(selectInfo.selectedRow.indexOf(row[ROW_DATA_INDEX]), 1);
        }
      }
    };

    if (clickTimer) {
      clearTimeout(clickTimer);
    }
    clickTimer = setTimeout(() => {
      if (selectInfo.useSelect) {
        const rowData = row[ROW_DATA_INDEX];
        const selected = row[ROW_SELECT_INDEX];
        row[ROW_SELECT_INDEX] = !row[ROW_SELECT_INDEX];
        let keyType = '';
        if (event.shiftKey) {
          keyType = 'shift';
        } else if (event.ctrlKey) {
          keyType = 'ctrl';
        }

        if (selectInfo.multiple && keyType) { // multi select
          onMultiSelectByKey(keyType, selected, rowData);
        } else if (isRight || isContextmenu) {
          selectInfo.selectedRow = [...selectInfo.selectedRow];
          if (!selectInfo.selectedRow.includes(rowData)) {
            selectInfo.selectedRow = [rowData];
          }
        } else if (selected) { // single select
          selectInfo.selectedRow = [];
        } else {
          selectInfo.selectedRow = [rowData];
        }
        lastIndex = row[ROW_INDEX];
        emit('update:selected', selectInfo.selectedRow);
        emit('click-row', getClickedRowData(event, row));
      }
    }, 100);
    return true;
  };
  /**
   * row dblclick 이벤트를 처리한다.
   *
   * @param {object} event - 이벤트 객체
   * @param {array} row - row 데이터
   */
  const onRowDblClick = (event, row) => {
    if (clickTimer) {
      clearTimeout(clickTimer);
    }
    emit('dblclick-row', getClickedRowData(event, row));
  };
  return { onRowClick, onRowDblClick };
};

export const checkEvent = (params) => {
  const { checkInfo, stores, pageInfo, getPagingData } = params;
  const { props, emit } = getCurrentInstance();
  /**
   * row에 대한 체크 상태를 해제한다.
   *
   * @param {array} row - row 데이터
   */
  const unCheckedRow = (row) => {
    const index = stores.originStore.findIndex(
      item => item[ROW_DATA_INDEX] === row[ROW_DATA_INDEX]);

    if (index !== -1) {
      stores.originStore[index][ROW_CHECK_INDEX] = row[ROW_CHECK_INDEX];
    }
  };
  /**
   * checkbox click 이벤트를 처리한다.
   *
   * @param {object} event - 이벤트 객체
   * @param {array} row - row 데이터
   */
  const onCheck = (event, row) => {
    if (checkInfo.useCheckbox.mode === 'single' && checkInfo.prevCheckedRow.length) {
      checkInfo.prevCheckedRow[ROW_CHECK_INDEX] = false;
      unCheckedRow(checkInfo.prevCheckedRow);
    }

    if (row[ROW_CHECK_INDEX]) {
      if (checkInfo.useCheckbox.mode === 'single') {
        checkInfo.checkedRows = [row[ROW_DATA_INDEX]];
      } else {
        checkInfo.checkedRows.push(row[ROW_DATA_INDEX]);
      }
      let store = stores.store;
      if (pageInfo.isClientPaging) {
        store = getPagingData();
      }

      const isAllChecked = store
        .filter(rowData => !props.uncheckable.includes(rowData[ROW_DATA_INDEX]))
        .filter(rowData => !props.disabledRows.includes(rowData[ROW_DATA_INDEX]))
        .every(d => d[ROW_CHECK_INDEX]);
      if (store.length && isAllChecked) {
        checkInfo.isHeaderChecked = true;
      }
      checkInfo.isHeaderIndeterminate = store.length && !isAllChecked;
    } else {
      if (checkInfo.useCheckbox.mode === 'single') {
        checkInfo.checkedRows = [];
      } else {
        checkInfo.checkedRows.splice(checkInfo.checkedRows.indexOf(row[ROW_DATA_INDEX]), 1);
      }
      checkInfo.isHeaderChecked = false;
      checkInfo.isHeaderIndeterminate = !!(stores.store.length && checkInfo.checkedRows.length);
    }
    checkInfo.prevCheckedRow = row.slice();
    emit('update:checked', checkInfo.checkedRows);
    emit('check-row', event, row[ROW_INDEX], row[ROW_DATA_INDEX]);
  };
  /**
   * all checkbox click 이벤트를 처리한다.
   *
   * @param {object} event - 이벤트 객체
   */
  const onCheckAll = (event) => {
    const isHeaderChecked = checkInfo.isHeaderChecked;
    let store = stores.store;
    if (pageInfo.isClientPaging) {
      store = getPagingData();
    }
    store.forEach((row) => {
      const uncheckable = props.uncheckable.includes(row[ROW_DATA_INDEX])
        || props.disabledRows.includes(row[ROW_DATA_INDEX]);
      if (isHeaderChecked) {
        if (!checkInfo.checkedRows.includes(row[ROW_DATA_INDEX]) && !uncheckable) {
          checkInfo.checkedRows.push(row[ROW_DATA_INDEX]);
        }
      } else {
        checkInfo.checkedRows.splice(checkInfo.checkedRows.indexOf(row[ROW_DATA_INDEX]), 1);
      }

      if (!uncheckable) {
        row[ROW_CHECK_INDEX] = isHeaderChecked;
      }
    });
    checkInfo.isHeaderIndeterminate = false;
    emit('update:checked', checkInfo.checkedRows);
    emit('check-all', event, checkInfo.checkedRows);
  };
  return { onCheck, onCheckAll };
};

export const expandEvent = (params) => {
  const { expandedInfo } = params;
  const { emit } = getCurrentInstance();

  /**
   * expand click 이벤트를 처리한다.
   *
   * @param {object} event - 이벤트 객체
   * @param {array} row - row 데이터
   */
  const onExpanded = (event, row) => {
    const data = row[ROW_DATA_INDEX];
    const index = expandedInfo.expandedRows.indexOf(data);
    if (index === -1) {
      expandedInfo.expandedRows.push(data);
    } else {
      expandedInfo.expandedRows.splice(index, 1);
    }
    row[ROW_EXPAND_INDEX] = !row[ROW_EXPAND_INDEX];
    emit('update:expanded', expandedInfo.expandedRows);
    emit('expand-row', event, row[ROW_DATA_INDEX], row[ROW_EXPAND_INDEX], row[ROW_INDEX]);
  };

  return {
    onExpanded,
  };
};

export const sortEvent = (params) => {
  const { sortInfo, stores, updatePagingInfo } = params;
  const { emit } = getCurrentInstance();

  const getDefaultSortType = (includeInit = true) => (includeInit ? ['asc', 'desc', 'init'] : ['asc', 'desc']);
  function OrderQueue() {
    this.orders = getDefaultSortType();
    this.dequeue = () => this.orders.shift();
    this.enqueue = o => this.orders.push(o);
  }

  const setSortOptionToOrderedColumns = (column, sortType = 'init') => {
    stores.orderedColumns.forEach((orderedColumn) => {
      if (orderedColumn.index === column?.index && sortType) {
        orderedColumn.sortOption = { sortType };
      } else {
        orderedColumn.sortOption = { sortType: 'init' };
      }
    });
  };

  const initializeHiddenColumnsSortType = () => {
    const hiddenColumns = stores.originColumns.filter(col => col.hiddenDisplay || col.hide);
    if (hiddenColumns.length) {
      hiddenColumns.forEach((col) => {
        col.sortOption = { sortType: 'init' };
      });
    }
  };

  const order = new OrderQueue();
  const setSortInfo = (column, emitTriggered = true) => {
    const { sortType } = column?.sortOption || {};
    sortInfo.sortColumn = column;
    sortInfo.sortField = column?.field;
    sortInfo.sortOrder = sortType;
    sortInfo.isSorting = !!(sortType);

    if (emitTriggered) {
      setSortOptionToOrderedColumns(column, sortType);

      emit('change-column-info', {
        type: 'sort',
        columns: getUpdatedColumns(stores),
      });
    }
  };

  /**
   * sort 이벤트를 처리한다.
   *
   * @param {object} column - 컬럼 정보
   * @param {string} sortOrder - 정렬 순서
   */
  const onSort = (column, sortOrder) => {
    const sortable = column.sortable === undefined ? true : column.sortable;
    if (sortable) {
      sortInfo.sortColumn = column;
      if (sortInfo.sortField !== column?.field) {
        order.orders = getDefaultSortType();
        sortInfo.sortField = column?.field;
      }
      if (sortOrder) {
        order.orders = getDefaultSortType();
        if (sortOrder === 'desc') {
          sortInfo.sortOrder = order.dequeue();
          order.enqueue(sortInfo.sortOrder);
        }
      }
      sortInfo.sortOrder = order.dequeue();
      order.enqueue(sortInfo.sortOrder);

      sortInfo.isSorting = true;
      updatePagingInfo({ onSort: true });

      initializeHiddenColumnsSortType();
      setSortOptionToOrderedColumns(column, sortInfo.sortOrder);

      const updatedColumInfo = getUpdatedColumns(stores);
      emit('sort-column', {
        field: sortInfo.sortField,
        order: sortInfo.sortOrder,
        column: sortInfo.sortColumn,
        columns: updatedColumInfo,
      });

      emit('change-column-info', {
        type: 'sort',
        columns: updatedColumInfo,
      });
    }
  };
  /**
   * 설정값에 따라 해당 컬럼 데이터에 대해 정렬한다.
   */
  const setSort = () => {
    const { field, index } = sortInfo.sortColumn || {};
    const customSetAsc = sortInfo.sortFunction?.[field] ?? null;
    const setDesc = (a, b) => (a > b ? -1 : 1);
    const setAsc = (a, b) => (a < b ? -1 : 1);
    const numberSetDesc = (a, b) => ((a === null) - (b === null) || Number(b) - Number(a));
    const numberSetAsc = (a, b) => ((a === null) - (b === null) || Number(a) - Number(b));
    if (sortInfo.sortOrder === 'init' || (!sortInfo.sortField && !sortInfo.isSorting)) {
      stores.store.sort((a, b) => {
        if (typeof a[ROW_INDEX] === 'number') {
          return setAsc(a[ROW_INDEX], b[ROW_INDEX]);
        }
        return 0;
      });
      return;
    }
    const type = sortInfo.sortColumn.type || 'string';
    const sortFn = sortInfo.sortOrder === 'desc' ? setDesc : setAsc;
    const numberSortFn = sortInfo.sortOrder === 'desc' ? numberSetDesc : numberSetAsc;
    const getColumnValue = (a, b) => {
      let aCol = a[ROW_DATA_INDEX][index];
      let bCol = b[ROW_DATA_INDEX][index];
      if (a[ROW_DATA_INDEX][index] && typeof a[ROW_DATA_INDEX][index] === 'object') {
        aCol = a[ROW_DATA_INDEX][index][stores.originColumns[index]?.field];
        bCol = b[ROW_DATA_INDEX][index][stores.originColumns[index]?.field];
      }
      return { aCol, bCol };
    };

    if (customSetAsc) {
      stores.store.sort((a, b) => {
        /*
          배열 및 객체일 경우 customAscFunc 사용자에게 데이터 전처리를 맡길 수 있게끔
          getColumnValue 사용 안함
        */
        const aCol = a[ROW_DATA_INDEX][index];
        const bCol = b[ROW_DATA_INDEX][index];
        const compareAscReturn = customSetAsc(aCol, bCol);
        return sortInfo.sortOrder === 'desc' ? -compareAscReturn : compareAscReturn;
      });
      return;
    }
    switch (type) {
      case 'string':
        stores.store.sort((a, b) => {
          let { aCol, bCol } = getColumnValue(a, b);
          if ((!aCol || typeof aCol === 'string') && (!bCol || typeof bCol === 'string')) {
            aCol = aCol || '';
            bCol = bCol || '';
            return sortFn(aCol?.toLowerCase(), bCol?.toLowerCase());
          }
          return 0;
        });
        break;
      case 'stringNumber':
        stores.store.sort((a, b) => {
          let { aCol, bCol } = getColumnValue(a, b);
          if (!aCol || typeof aCol === 'string' || typeof aCol === 'number') {
            aCol = aCol === '' ? null : aCol;
            bCol = bCol === '' ? null : bCol;
            return numberSortFn(aCol ?? null, bCol ?? null);
          }
          return 0;
        });
        break;
      default:
        stores.store.sort((a, b) => {
          const { aCol, bCol } = getColumnValue(a, b);
          if (!aCol || typeof aCol === 'number' || typeof aCol === 'boolean') {
            return numberSortFn(aCol ?? null, bCol ?? null);
          }
          return 0;
        });
        break;
    }
  };

  const getSortTarget = () => stores.orderedColumns?.find(
    column => column?.sortOption && getDefaultSortType(false).includes(column.sortOption.sortType),
  );
  const hasSortTarget = () => !!getSortTarget();

  return { onSort, getSortTarget, setSort, setSortInfo, hasSortTarget };
};

export const filterEvent = (params) => {
  const { props } = getCurrentInstance();
  const {
    columnSettingInfo,
    filterInfo,
    stores,
    checkInfo,
    pageInfo,
    getConvertValue,
    updateVScroll,
    getPagingData,
    updatePagingInfo,
    getColumnIndex,
  } = params;
  /**
   * 헤더 체크박스 상태를 체크한다.
   *
   * @param {array} rowData - row 데이터
   */
  const setHeaderCheckboxByFilter = (rowData) => {
    let checkedCount = 0;
    rowData.forEach((row) => {
      const isChecked = checkInfo.checkedRows.includes(row[ROW_DATA_INDEX]);
      row[ROW_CHECK_INDEX] = isChecked;
      checkedCount += isChecked ? 1 : 0;
    });
    if (rowData.length) {
      checkInfo.isHeaderChecked = rowData.length === checkedCount;
      checkInfo.isHeaderIndeterminate = (rowData.length !== checkedCount) && checkedCount > 0;
      checkInfo.isHeaderUncheckable = rowData
        .every(row => props.uncheckable.includes(row[ROW_DATA_INDEX])
          || props.disabledRows.includes(row[ROW_DATA_INDEX]));
    }
  };
  /**
   * 전달받은 문자열 내 해당 키워드가 존재하는지 확인한다.
   *
   * @param {string} conditionValue - 검색 키워드
   * @param {string} value - 기준 문자열
   * @param {string} pos - 시작, 끝나는 문자열
   * @returns {boolean} 문자열 내 키워드 존재 유무
   */
  const findLike = (conditionValue, value, pos) => {
    if (typeof conditionValue !== 'string' || value === null) {
      return false;
    }
    const baseValueLower = value?.toLowerCase();
    const conditionValueLower = conditionValue?.toLowerCase();
    let result = baseValueLower.includes(conditionValueLower);
    if (pos) {
      if (pos === 'start') {
        result = baseValueLower.startsWith(conditionValueLower);
      } else if (pos === 'end') {
        result = baseValueLower.endsWith(conditionValueLower);
      }
    }
    return result;
  };
  /**
   * 필터 조건에 따라 문자열을 확인한다.
   *
   * @param {array} item - row 데이터
   * @param {object} condition - 필터 정보
   * @returns {boolean} 확인 결과
   */
  const stringFilter = (item, condition) => {
    const comparison = condition.comparison;
    const conditionValue = condition.value;
    let value = item[ROW_DATA_INDEX][condition.index];
    if (value || value === 0) {
      value = `${item[ROW_DATA_INDEX][condition.index]}`;
    }
    let result;
    if (comparison === '=') {
      result = conditionValue?.toLowerCase() === value?.toLowerCase();
    } else if (comparison === '!=') {
      result = conditionValue?.toLowerCase() !== value?.toLowerCase();
    } else if (comparison === '%s%') {
      result = findLike(conditionValue, value);
    } else if (comparison === 'notLike') {
      result = !findLike(conditionValue, value);
    } else if (comparison === 's%') {
      result = findLike(conditionValue, value, 'start');
    } else if (comparison === '%s') {
      result = findLike(conditionValue, value, 'end');
    } else if (comparison === 'isEmpty') {
      result = value === undefined || value === null || value === '';
    } else if (comparison === 'isNotEmpty') {
      result = !!value;
    }

    return result;
  };
  /**
   * 필터 조건에 따라 숫자를 확인한다.
   *
   * @param {array} item - row 데이터
   * @param {object} condition - 필터 정보
   * @param {string} columnType - 데이터 유형
   * @returns {boolean} 확인 결과
   */
  const numberFilter = (item, condition, columnType) => {
    const comparison = condition.comparison;
    const conditionValue = Number(condition.value.replace(/,/g, '')); // 콤마 제거
    let value = Number(item[ROW_DATA_INDEX][condition.index]);
    let result;
    if (columnType === 'float') {
      value = Number(value.toFixed(3));
    }

    if (comparison === '=') {
      result = value === conditionValue;
    } else if (comparison === '>') {
      result = value > conditionValue;
    } else if (comparison === '<') {
      result = value < conditionValue;
    } else if (comparison === '<=') {
      result = value <= conditionValue;
    } else if (comparison === '>=') {
      result = value >= conditionValue;
    } else if (comparison === '!=') {
      result = value !== conditionValue;
    } else if (comparison === 'isEmpty') {
      result = value === undefined || value === null || isNaN(value);
    } else if (comparison === 'isNotEmpty') {
      result = !!value || value === 0;
    }

    return result;
  };
  const booleanFilter = (item, condition) => {
    const comparison = condition.comparison;
    const conditionValue = condition.value;
    const value = `${item[ROW_DATA_INDEX][condition.index]}`;
    let result;

    if (comparison === '=') {
      result = value === conditionValue;
    }

    return result;
  };
  /**
   * 필터 조건이 적용된 데이터를 반환한다.
   *
   * @param {array} data - row 데이터
   * @param {string} columnType - 데이터 유형
   * @param {object} condition - 필터 정보
   * @returns {boolean} 확인 결과
   */
  const getFilteringData = (data, columnType, condition) => {
    let filterFn = columnType === 'string' || columnType === 'stringNumber'
      ? stringFilter : numberFilter;
    if (columnType === 'boolean') {
      filterFn = booleanFilter;
    }
    return data.filter(row => filterFn(row, condition, columnType)) || [];
  };
  /**
   * 전체 데이터에서 설정된 필터 적용 후 결과를 filterStore 에 저장한다.
   */
  const setFilter = () => {
    const filteringItemsByColumn = filterInfo.filteringItemsByColumn;
    const fields = Object.keys(filteringItemsByColumn);
    const originStore = stores.originStore;
    let filterStore = [];
    let filteredOnce = false;
    let prevStore = [];

    fields.forEach((field, idx) => {
      const filters = filteringItemsByColumn[field];
      const index = getColumnIndex(field);
      const columnType = props.columns[index].type;
      const OR = filterInfo.columnOperator === 'or';
      const AND = idx > 0 && filterInfo.columnOperator === 'and';

      filters.forEach((item, ix) => {
        if (!filterStore.length && !filteredOnce) {
          filterStore = getFilteringData(originStore, columnType, {
            ...item,
            index,
          });
        } else if (AND && item.operator === 'or') {
          if (ix > 0) {
            filterStore.push(...getFilteringData(prevStore, columnType, {
              ...item,
              index,
            }));
          } else { // ix === 0
            filterStore = getFilteringData(prevStore, columnType, {
              ...item,
              index,
            });
          }
        } else if ((ix === 0 && OR) || (ix !== 0 && item.operator === 'or')) {
          filterStore.push(...getFilteringData(originStore, columnType, {
            ...item,
            index,
          }));
        } else {
          filterStore = getFilteringData(filterStore, columnType, {
            ...item,
            index,
          });
        }
        filteredOnce = true;
      });
      prevStore = JSON.parse(JSON.stringify(filterStore));
    });

    if (!filteredOnce) {
      stores.filterStore = originStore;
    } else {
      stores.filterStore = uniqBy(filterStore, JSON.stringify);
    }
  };

  let searchTimer = null;
  const onSearch = (searchWord) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      filterInfo.isSearch = false;
      filterInfo.searchWord = searchWord;
      if (searchWord) {
        stores.searchStore = stores.store.filter((row) => {
          let isShow = false;
          const rowData = columnSettingInfo.isFilteringColumn ? row[ROW_DATA_INDEX]
            .filter((data, idx) => columnSettingInfo.visibleColumnIdx
              .includes(idx)) : row[ROW_DATA_INDEX];

          for (let ix = 0; ix < stores.orderedColumns.length; ix++) {
            const column = stores.orderedColumns[ix] || {};
            let columnValue = rowData[ix] ?? null;
            column.type = column.type || 'string';
            if (columnValue !== null) {
              if (typeof columnValue === 'object') {
                columnValue = columnValue[column.field];
              }
              if (!column.hide && (column?.searchable === undefined || column?.searchable)) {
                columnValue = getConvertValue(column, columnValue).toString();
                isShow = columnValue.toLowerCase().includes(searchWord.toString().toLowerCase());
                if (isShow) {
                  break;
                }
              }
            }
          }
          return isShow;
        });
        filterInfo.isSearch = true;
      }
      setHeaderCheckboxByFilter(stores.store);
      if (!searchWord && pageInfo.isClientPaging && pageInfo.prevPage) {
        pageInfo.currentPage = 1;
        stores.pagingStore = getPagingData();
      }

      updatePagingInfo({ onSearch: true });
      updateVScroll();
    }, 500);
  };
  return { onSearch, setFilter, setHeaderCheckboxByFilter };
};

export const contextMenuEvent = (params) => {
  const {
    contextInfo,
    stores,
    selectInfo,
    onSort,
    filterInfo,
    useGridSetting,
    columnSettingInfo,
    setColumnHidden,
  } = params;
  /**
   * 컨텍스트 메뉴를 설정한다.
   *
   * @param {object} event - 이벤트 객체
   */
  let contextmenuTimer = null;
  const { emit } = getCurrentInstance();
  const setContextMenu = (e) => {
    if (contextmenuTimer) {
      clearTimeout(contextmenuTimer);
    }
    const menuItems = [];
    contextmenuTimer = setTimeout(() => {
      if (contextInfo.customContextMenu.length) {
        const customItems = contextInfo.customContextMenu.map(
          (item) => {
            const menuItem = item;
            if (menuItem.validate) {
              menuItem.disabled = !menuItem.validate(menuItem.itemId, selectInfo.selectedRow);
            }

            menuItem.selectedRow = selectInfo.selectedRow ?? [];
            menuItem.contextmenuInfo = selectInfo.contextmenuInfo ?? [];

            return menuItem;
          });

        menuItems.push(...customItems);
      }

      contextInfo.contextMenuItems = menuItems;
      contextInfo.menu.show(e);
    }, 200);
  };
  /**
   * 마우스 우클릭 이벤트를 처리한다.
   *
   * @param {object} e - 이벤트 객체
   */
  const onContextMenu = (e) => {
    e.preventDefault();
    const target = e.target;
    const rowIndex = target.closest('.row')?.dataset?.index;
    let clickedRow = null;
    if (rowIndex) {
      clickedRow = stores.viewStore.find(row => row[ROW_INDEX] === +rowIndex)?.[ROW_DATA_INDEX];
    }
    if (clickedRow) {
      selectInfo.contextmenuInfo = [clickedRow];
      setContextMenu(e);
    }
  };
  /**
   * 컬럼 기능을 수행하는 Contextmenu 를 생성한다.
   *
   * @param {object} event - 이벤트 객체
   * @param {object} column - 컬럼 정보
   */
  const onColumnContextMenu = (event, column) => {
    if (event.target.className === 'column-name') {
      const sortable = column.sortable === undefined ? true : column.sortable;
      const filterable = filterInfo.isFiltering
      && column.filterable === undefined ? true : column.filterable;
      const columnMenuItems = [
        {
          text: contextInfo.columnMenuTextInfo?.ascending ?? 'Ascending',
          iconClass: 'ev-icon-allow2-up',
          disabled: !sortable,
          hidden: contextInfo.hiddenColumnMenuItem?.ascending,
          click: () => onSort(column, 'asc'),
        },
        {
          text: contextInfo.columnMenuTextInfo?.descending ?? 'Descending',
          iconClass: 'ev-icon-allow2-down',
          disabled: !sortable,
          hidden: contextInfo.hiddenColumnMenuItem?.descending,
          click: () => onSort(column, 'desc'),
        },
        {
          text: contextInfo.columnMenuTextInfo?.filter ?? 'Filter',
          iconClass: 'ev-icon-filter-list',
          click: () => {
            const docWidth = document.documentElement.clientWidth;
            const clientX = contextInfo.columnMenu.menuStyle.clientX;
            const pageX = contextInfo.columnMenu.menuStyle.pageX;
            const MODAL_WIDTH = 350;
            const isOver = docWidth < clientX + MODAL_WIDTH;
            if (isOver) {
              contextInfo.columnMenu.menuStyle.left = `${pageX - MODAL_WIDTH}px`;
            }
            filterInfo.filterSettingPosition = {
              top: contextInfo.columnMenu.menuStyle.top,
              left: contextInfo.columnMenu.menuStyle.left,
            };
            filterInfo.isShowFilterSetting = true;
            filterInfo.filteringColumn = column;

            emit('change-column-info', {
              type: 'filter',
              columns: stores.updatedColumns,
            });
          },
          disabled: !filterable,
          hidden: contextInfo.hiddenColumnMenuItem?.filter,
        },
        {
          text: contextInfo.columnMenuTextInfo?.hide ?? 'Hide',
          iconClass: 'ev-icon-visibility-off',
          disabled: !useGridSetting.value || stores.orderedColumns.length === 1,
          hidden: contextInfo.hiddenColumnMenuItem?.hide,
          click: () => {
            setColumnHidden(column.field);
            emit('change-column-status', {
              columns: stores.updatedColumns,
            });

            emit('change-column-info', {
              type: 'display',
              columns: stores.updatedColumns,
            });
          },
        },
      ];
      contextInfo.columnMenuItems = [];
      if (!sortable && !filterable) {
        return;
      }
      contextInfo.columnMenuItems = columnMenuItems.filter(item => !item.hidden);
    }
  };
  /**
   * 상단 우측의 Grid 옵션에 대한 Contextmenu 를 생성한다.
   *
   * @param {object} e - 이벤트 객체
   */
  const onGridSettingContextMenu = (e) => {
    const { useDefaultColumnSetting, columnSettingTextInfo } = columnSettingInfo;
    const columnListMenu = {
      text: columnSettingTextInfo?.title ?? 'Column List',
      isShowMenu: true,
      click: () => {
        columnSettingInfo.isShowColumnSetting = true;
        contextInfo.isShowMenuOnClick = true;
      },
    };

    if (contextInfo.customGridSettingContextMenu.length) {
      contextInfo.gridSettingContextMenuItems = [
        ...contextInfo.customGridSettingContextMenu,
      ];
    }

    if (useDefaultColumnSetting) {
      contextInfo.gridSettingContextMenuItems.push(columnListMenu);
    }
    contextInfo.gridSettingMenu.show(e);
  };

  return {
    setContextMenu,
    onContextMenu,
    onColumnContextMenu,
    onGridSettingContextMenu,
  };
};

export const storeEvent = (params) => {
  const { props } = getCurrentInstance();
  const {
    selectInfo,
    checkInfo,
    stores,
    sortInfo,
    elementInfo,
    filterInfo,
    expandedInfo,
    setSort,
    setSortInfo,
    updateVScroll,
    setFilter,
  } = params;
  /**
   * 전달된 데이터를 내부 store 및 속성에 저장한다.
   *
   * @param {array} rows - row 데이터
   * @param {boolean} isMakeIndex - 인덱스 생성 유무
   * @param {boolean} isInit - 초기 setStore 여부
   */
  const setStore = ({ rows, isMakeIndex = true, isInit = false }) => {
    const sortingColumns = stores.orderedColumns.find(
      column => column?.sortOption && ['asc', 'desc'].includes(column.sortOption.sortType),
    );

    if (isMakeIndex) {
      const store = [];
      let hasUnChecked = false;
      rows.forEach((row, idx) => {
        const checked = props.checked.includes(row);
        const uncheckable = props.uncheckable.includes(row) || props.disabledRows.includes(row);
        let selected = false;
        if (selectInfo.useSelect) {
          selected = props.selected.includes(row);
        }
        if (!checked && !uncheckable) {
          hasUnChecked = true;
        }
        let expanded = false;
        if (expandedInfo.useRowDetail) {
          expanded = props.expanded.includes(row);
        }
        const disabled = props.disabledRows.includes(row);
        store.push([idx, checked, row, selected, expanded, uncheckable, disabled]);
      });
      checkInfo.isHeaderChecked = rows.length > 0 ? !hasUnChecked : false;
      checkInfo.isHeaderIndeterminate = hasUnChecked && !!checkInfo.checkedRows.length;
      checkInfo.isHeaderUncheckable = rows.every(row => props.uncheckable.includes(row)
        || props.disabledRows.includes(row));
      stores.originStore = store;
    }
    if (filterInfo.isFiltering) {
      setFilter();
    }

    if (sortingColumns && isInit) {
      setSortInfo(sortingColumns, false);
    }

    if (sortInfo.sortField) {
      setSort();
    }
    if (elementInfo.body?.clientHeight) {
      updateVScroll();
    }
  };
  return { setStore };
};

export const pagingEvent = (params) => {
  const { emit } = getCurrentInstance();
  const {
    stores,
    pageInfo,
    sortInfo,
    filterInfo,
    elementInfo,
    clearCheckInfo,
  } = params;
  const getPagingData = () => {
    const start = (pageInfo.currentPage - 1) * pageInfo.perPage;
    const end = parseInt(start, 10) + parseInt(pageInfo.perPage, 10);
    return stores.store.slice(start, end);
  };
  const updatePagingInfo = (eventName) => {
    emit('page-change', {
      eventName,
      pageInfo: {
        currentPage: pageInfo.currentPage,
        prevPage: pageInfo.prevPage,
        startIndex: pageInfo.startIndex,
        total: pageInfo.pageTotal,
        perPage: pageInfo.perPage,
      },
      sortInfo: {
        field: sortInfo.sortField,
        order: sortInfo.sortOrder,
      },
      searchInfo: {
        searchWord: filterInfo.searchWord,
        searchColumns: stores.orderedColumns
          .filter(c => !c.hide && (c?.searchable === undefined || c?.searchable))
          .map(d => d.field),
      },
    });
    if (pageInfo.isInfinite && (eventName?.onSearch || eventName?.onSort)) {
      pageInfo.currentPage = 1;
      elementInfo.body.scrollTop = 0;
      clearCheckInfo();
    }
  };
  const changePage = (beforeVal) => {
    if (pageInfo.isClientPaging) {
      pageInfo.prevPage = beforeVal;
      if (stores.store.length <= pageInfo.perPage) {
        stores.pagingStore = stores.store;
      } else {
        const start = (pageInfo.currentPage - 1) * pageInfo.perPage;
        const end = parseInt(start, 10) + parseInt(pageInfo.perPage, 10);
        stores.pagingStore = stores.store.slice(start, end);
        elementInfo.body.scrollTop = 0;
        pageInfo.startIndex = start;
      }
    }
    updatePagingInfo({ onChangePage: true });
  };
  return { getPagingData, updatePagingInfo, changePage };
};

export const columnSettingEvent = (params) => {
  const { props, emit } = getCurrentInstance();
  const {
    stores,
    columnSettingInfo,
    contextInfo,
    onSearch,
    onResize,
  } = params;

  const setPositionColumnSetting = (toolbarRef) => {
    if (!columnSettingInfo.isShowColumnSetting) {
      return;
    }
    columnSettingInfo.columnSettingPosition.columnListMenuWidth = 0;

    if (contextInfo.gridSettingContextMenuItems.length) {
      // 컨텍스트 메뉴 형태인 경우
      const columnListMenu = contextInfo.gridSettingContextMenuItems.length - 1;
      const columnListMenuRect = contextInfo.gridSettingMenu?.rootMenuList?.$el?.children[0]
        .children[columnListMenu].getBoundingClientRect();

      columnSettingInfo.columnSettingPosition.columnListMenuWidth = columnListMenuRect.width;
      columnSettingInfo.columnSettingPosition.top = columnListMenuRect.top;
      columnSettingInfo.columnSettingPosition.left = columnListMenuRect.right;
    } else {
      // 컬럼 리스트만 있는 경우
      const toolbarRefDivRect = toolbarRef?.getBoundingClientRect();
      const toolbarHeight = toolbarRefDivRect?.height;

      columnSettingInfo.columnSettingPosition.top = toolbarRefDivRect?.top + toolbarHeight;
      columnSettingInfo.columnSettingPosition.left = toolbarRefDivRect?.right;
    }
  };

  const initColumnSettingInfo = () => {
    stores.filteredColumns.length = 0;
    // columnSettingInfo.isShowColumnSetting = false;
    columnSettingInfo.isFilteringColumn = false;
    columnSettingInfo.visibleColumnIdx = [];
    columnSettingInfo.hiddenColumn = '';
  };
  const setFilteringColumn = () => {
    columnSettingInfo.visibleColumnIdx = stores.filteredColumns.map(col => col.index);

    const originColumnIdx = stores.originColumns.filter(col => (!col.hide || col.hiddenDisplay))
      .map(col => col.index);
    const visibleColumnIdx = columnSettingInfo.visibleColumnIdx;

    columnSettingInfo.isFilteringColumn = (visibleColumnIdx.length !== originColumnIdx.length);

    // 컬럼을 필터링했을 때, 검색어가 있는 경우 재검색
    if (props.option.searchValue) {
      onSearch(props.option.searchValue);
    }
    onResize();
  };
  const onApplyColumn = (columnNames) => {
    const columns = stores.orderedColumns.filter(col => !col.hide && !col.hiddenDisplay);
    const isSameColumn = columnNames.length === columns.length
      && columns.every(col => columnNames.includes(col.field));

    if (isSameColumn) {
      return;
    }

    stores.filteredColumns = stores.originColumns
      .filter((col) => {
        if (columnNames.includes(col.field) || !col.caption) {
          // 보여줄 컬럼들은 hiddenDisplay 속성을 false로 전부 적용
          col.hiddenDisplay = false;
          return true;
        }

        // 보여주지 않을 컬럼들은 hiddenDisplay 속성을 전부 ture로 적용
        col.hiddenDisplay = true;
        return false;
      });
    columnSettingInfo.hiddenColumn = '';
    setFilteringColumn();
    emit('change-column-status', {
      columns: stores.updatedColumns,
    });

    emit('change-column-info', {
      type: 'display',
      columns: stores.updatedColumns,
    });
  };
  const setColumnHidden = (val) => {
    const columns = stores.orderedColumns.filter(col => !col.hide && !col.hiddenDisplay);

    if (columns.length === 1) {
      return;
    }
    stores.filteredColumns = columns
      .filter((col) => {
        if (col.field !== val) {
          col.hiddenDisplay = false;
          return true;
        }
        col.hiddenDisplay = true;
        return false;
      });
    columnSettingInfo.hiddenColumn = val;
    setFilteringColumn();
  };

  return {
    setPositionColumnSetting,
    initColumnSettingInfo,
    onApplyColumn,
    setColumnHidden,
  };
};

export const dragEvent = ({ stores }) => {
  const { emit } = getCurrentInstance();
  const setColumnMoving = (currentIndex, droppedIndex) => {
    const oldIndex = parseInt(currentIndex, 10);
    const newPositionIndex = parseInt(droppedIndex, 10);

    if (!Number.isInteger(oldIndex) || !Number.isInteger(newPositionIndex)) {
      return;
    }

    const columns = [...stores.orderedColumns];
    const movedColumn = columns[oldIndex];

    columns.splice(oldIndex, 1);
    columns.splice(newPositionIndex, 0, movedColumn);

    if (stores.filteredColumns.length) {
      stores.filteredColumns = columns;
    } else {
      stores.movedColumns = columns;
    }
  };
  const onDragStart = (e) => {
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.index);
  };
  const onDragOver = (e) => {
    e.preventDefault();
  };
  const onDrop = (e) => {
    e.preventDefault();
    const currentIndex = e.dataTransfer.getData('text/plain');
    const droppedIndex = e.target.parentNode.dataset.index;
    setColumnMoving(currentIndex, droppedIndex);
    emit('change-column-order', {
      column: stores.orderedColumns[droppedIndex],
      columns: stores.updatedColumns,
    });

    emit('change-column-info', {
      type: 'order',
      columns: stores.updatedColumns,
    });
  };
  return {
    onDragStart,
    onDragOver,
    onDrop,
  };
};
