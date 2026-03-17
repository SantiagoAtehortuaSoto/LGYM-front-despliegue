import { useState } from 'react';

export const useStatusManagement = (initialItems = []) => {
  const [items, setItems] = useState(initialItems);
  const [filteredItems, setFilteredItems] = useState(initialItems);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleStatusChange = (updatedItem, newStatus) => {
    const updatedItems = items.map(item => 
      item.id === updatedItem.id ? { ...item, estado: newStatus } : item
    );
    setItems(updatedItems);
    setFilteredItems(updatedItems);
    return updatedItems;
  };

  const handleSearch = (searchValue, searchField = 'nombre') => {
    const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lowercasedSearchTerm = removeAccents(searchValue.toLowerCase());

    const results = items.filter(item =>
      removeAccents(String(item[searchField]).toLowerCase()).includes(lowercasedSearchTerm)
    );
    setFilteredItems(results);
    setSearchTerm(searchValue);
  };

  const openModal = (action, item = null) => {
    setSelectedItem(item);
    setModalAction(action);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setModalAction(null);
  };

  const createItem = (newItem) => {
    const newItems = [...items, { ...newItem, id: Date.now() }];
    setItems(newItems);
    setFilteredItems(newItems);
    return newItems;
  };

  const updateItem = (updatedItem) => {
    const newItems = items.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    );
    setItems(newItems);
    setFilteredItems(newItems);
    return newItems;
  };

  const deleteItem = (itemToDelete) => {
    const newItems = items.filter(item => item.id !== itemToDelete.id);
    setItems(newItems);
    setFilteredItems(newItems);
    return newItems;
  };

  return {
    items,
    filteredItems,
    selectedItem,
    modalAction,
    searchTerm,
    setItems,
    setFilteredItems,
    handleStatusChange,
    handleSearch,
    openModal,
    closeModal,
    createItem,
    updateItem,
    deleteItem,
  };
};
