import React from 'react';
import Select, {Props} from 'react-select';

const customStyles = {
  container: (provided: any) => ({
    ...provided,
    lineHeight: 'initial',
    flex: 1,
  }),
  input: (provided: any) => ({
    ...provided,
    color: 'var(--color_label-highlighted)',
  }),
  singleValue: (provided: any) => ({
    ...provided,
    color: 'var(--color_label-highlighted)',
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: 'var(--color_label)',
  }),
  dropdownIndicator: (provided: any) => ({
    ...provided,
    color: 'var(--color_label)',
    padding: 6,
  }),
  indicatorSeparator: () => ({display: 'none'}),
  valueContainer: (provided: any) => ({
    ...provided,
    padding: '0 8px',
    color: 'var(--color_label-highlighted)',
  }),
  control: (provided: any, state: any) => ({
    ...provided,
    boxShadow: 'none',
    minHeight: 34,
    height: 34,
    borderRadius: 8,
    fontSize: 12.5,
    ':active': {
      backgroundColor: 'transparent',
      borderColor: 'var(--color_accent)',
    },
    '&:hover': {
      borderColor: 'var(--color_accent)',
    },
    color: 'var(--color_label-highlighted)',
    border: '1px solid var(--border_color_cell)',
    background: 'var(--bg_menu)',
    overflow: 'hidden',
    width: state.selectProps.width || 220,
  }),
  menu: (provided: any) => ({
    ...provided,
    borderRadius: 10,
    border: '1px solid var(--border_color_cell)',
    boxShadow: 'var(--shadow-2)',
    background: 'var(--bg_menu)',
    overflow: 'hidden',
    zIndex: 50,
  }),
  menuList: (provided: any) => ({
    ...provided,
    padding: 5,
    background: 'var(--bg_menu)',
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    borderRadius: 7,
    fontSize: 12.5,
    padding: '8px 9px',
    background: state.isSelected
      ? 'var(--bg_accent-soft)'
      : state.isFocused
        ? 'var(--bg_control)'
        : 'transparent',
    color: state.isSelected
      ? 'var(--color_accent)'
      : 'var(--color_label-highlighted)',
    cursor: 'pointer',
  }),
};

export const AccentSelect: React.FC<Props> = (props) => (
  <Select {...props} styles={customStyles} />
);
