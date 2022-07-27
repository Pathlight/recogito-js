import React from 'react';
import Select from 'react-select';

const CLASSIFYING = 'classifying'

const baseSelectOption = args => ({
  type: 'OptionSelection', value: '', purpose: CLASSIFYING, ...args
})

const SelectWidget = props => {
  // Use the context to determine which option to delete in the annotation.bodies
  // since we're using multiple SelectWidgets
  const {disabled, annotation, config} = props
  const {options, context, className, placeholder} = config

  const selectedOption = !annotation ? null : 
    annotation.bodies.find(b => b.purpose === CLASSIFYING && b.context === context);

  const onChange = option => {
    if (!option && selectedOption) {
      props.onRemoveBody(selectedOption)
    } else if (option) {
      const {value} = option
      const updatedOption = baseSelectOption({value, context});
      if (selectedOption) {
        props.onUpdateBody(selectedOption, updatedOption)
      } else {
        props.onAppendBody(updatedOption);
      }
    }
  }

  let selectedOptionValue = null;
  if (selectedOption) {
    selectedOptionValue = options.find(({value}) => value === selectedOption.value)
  }
  return !selectedOptionValue && disabled ? null :  (
      <Select
        value={selectedOptionValue}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        clearable
        className={className}
      />
  )

}

export default SelectWidget;
