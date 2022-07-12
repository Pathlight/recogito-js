import React, { useState, useRef } from 'react';
import useClickOutside from '../../useClickOutside';
import TextEntryField from './TextEntryField';
import { ChevronDownIcon, ChevronUpIcon } from '../../../Icons';
import i18n from '../../../i18n';

const DropdownMenu = props => {

  const ref = useRef();

  // Custom hook that notifies when clicked outside this component
  useClickOutside(ref, () => props.onClickOutside());

  return (
    <ul ref={ref} className="r6o-comment-dropdown-menu">
      <li onClick={props.onEdit}>{i18n.t('Edit')}</li>
      <li onClick={props.onDelete}>{i18n.t('Delete')}</li>
    </ul>
  )

}

/** A single comment inside the CommentWidget **/
const Comment = props => {

  const [ isEditable, setIsEditable ] = useState(false);
  const [ isMenuVisible, setIsMenuVisible ] = useState(false);

  const onMakeEditable = _ => {
    setIsEditable(true);
    setIsMenuVisible(false);
  }

  const onDelete = _ => {
    props.onDelete(props.body);
    setIsMenuVisible(false); 
  }

  const onUpdateComment = evt =>
    props.onUpdate(props.body, { ...props.body, value: evt.target.value });
  
  return props.readOnly ? (
    <div className="r6o-widget comment">
      <div className="r6o-readonly-comment">{props.body.value}</div>
    </div>
  ) : (
    <div className={ isEditable ? "r6o-widget comment editable" : "r6o-widget comment"}>
      <TextEntryField 
        editable={isEditable}
        content={props.body.value} 
        onChange={onUpdateComment} 
        onSaveAndClose={props.onSaveAndClose}
      />
          
      <div 
        className={isMenuVisible ? "r6o-icon r6o-arrow-down r6o-menu-open" : "r6o-icon r6o-arrow-down"} 
        onClick={() => setIsMenuVisible(!isMenuVisible)}>
        {isMenuVisible ? <ChevronUpIcon width={12} /> : <ChevronDownIcon width={12} />}
      </div>

      { isMenuVisible && 
        <DropdownMenu 
          onEdit={onMakeEditable} 
          onDelete={onDelete} 
          onClickOutside={() => setIsMenuVisible(false)} /> 
      }
    </div>
  )

}

export default Comment;