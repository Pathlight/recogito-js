import React, { Component } from 'react';
import { getWidget, DEFAULT_WIDGETS } from './widgets';
import Label from './Label';
import setPosition from './setPosition';
import i18n from '../i18n';

/** We need to compare bounds by value, not by object ref **/
const bounds = elem => {
  const { top, left, width, height } = elem.getBoundingClientRect();
  return `${top}, ${left}, ${width}, ${height}`;
}

/**
 * The popup editor component.
 * 
 * TODO instead of just updating the current annotation state,
 * we could create a stack of revisions, and allow going back
 * with CTRL+Z.
 */
export default class Editor extends Component {

  constructor(props) {
    super(props);

    // Reference to the DOM element, so we can set position
    this.element = React.createRef();

    this.state = {
      currentAnnotation: props.annotation,
      dragged: false,
      selectionBounds: bounds(props.selectedElement)
    }
  }

  componentWillReceiveProps(next) {
    const { selectionBounds } = this.state;
    const nextBounds = bounds(next.selectedElement);

    if (!this.props.annotation?.isEqual(next.annotation)) {
      this.setState({ 
        currentAnnotation: next.annotation,
        selectionBounds: nextBounds 
      });  
    } else {
      this.setState({ selectionBounds: nextBounds });
    }

    if (this.props.modifiedTarget != next.modifiedTarget) {
      // Update in case target was changed (move, resize)
      if (this.state.currentAnnotation)
        this.updateCurrentAnnotation({ target: this.props.modifiedTarget });
    }

    // Change editor position if element has moved
    if (selectionBounds != nextBounds) {
      if (this.element.current) {
        this.removeObserver && this.removeObserver();
        this.removeObserver = this.initResizeObserver();
      }
    }
  }

  componentDidMount() {
    this.removeObserver = this.initResizeObserver();

    // This makes sure the editor is repositioned if the widgets change
    const observer = new MutationObserver(() => {
      if (this.element.current) {
        this.removeObserver && this.removeObserver();
        this.removeObserver = this.initResizeObserver();
      }
    });

    observer.observe(this.element.current, { childList: true, subtree: true });
  }

  componentWillUnmount() {
    // Remove the observer
    this.removeObserver && this.removeObserver();
  }

  initResizeObserver = () => {
    // Defaults to true
    const autoPosition =
      this.props.autoPosition === undefined ? true : this.props.autoPosition;
  
    if (window?.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (!this.state.dragged)
          setPosition(this.props.wrapperEl, this.element.current, this.props.selectedElement, autoPosition,
            this.props.allowOrientLeft);
      });

      resizeObserver.observe(this.props.wrapperEl);
      return () => resizeObserver.disconnect();
    } else {
      // Fire setPosition manually *only* for devices that don't support ResizeObserver
      if (!this.state.dragged)
        setPosition(this.props.wrapperEl, this.element.current, this.props.selectedElement, autoPosition, 
          this.props.allowOrientLeft);
    }  
  }

  /** Creator and created/modified timestamp metadata **/
  creationMeta = body => {
    const meta = {};

    const { user } = this.props.env;

    // Metadata is only added when a user is set, otherwise
    // the Editor operates in 'anonymous mode'.
    if (user) {
      meta.creator = {};
      if (user.id) meta.creator.id = user.id;
      if (user.name) meta.creator.name = user.name;

      meta[body.created ? 'modified' : 'created'] = this.props.env.getCurrentTimeAdjusted();
    }

    return meta;
  }

  getCurrentAnnotation = () =>
    this.state.currentAnnotation.clone();

  /** Shorthand **/ 
  updateCurrentAnnotation = (diff, saveImmediately) => this.setState({
    currentAnnotation: this.state.currentAnnotation.clone(diff).updateModified()
  }, () => {
    if (saveImmediately)
      this.onOk();
  })

  onAppendBody = (body, saveImmediately) => this.updateCurrentAnnotation({ 
    body: [ 
      ...this.state.currentAnnotation.bodies, 
      { ...body, ...this.creationMeta(body) } 
    ] 
  }, saveImmediately);

  onUpdateBody = (previous, updated, saveImmediately) => this.updateCurrentAnnotation({
    body: this.state.currentAnnotation.bodies.map(body => 
      body === previous ? { ...updated, ...this.creationMeta(updated) } : body)
  }, saveImmediately);

  onRemoveBody = (body, saveImmediately) => this.updateCurrentAnnotation({
    body: this.state.currentAnnotation.bodies.filter(b => b !== body)
  }, saveImmediately);

  /** 
   * For convenience: an 'append or update' shorthand.
   */
   onUpsertBody = (arg1, arg2, saveImmediately) => {
    if (arg1 == null && arg2 != null) {
      // Append arg 2 as a new body
      this.onAppendBody(arg2, saveImmediately);
    } else if (arg1 != null && arg2 != null) {
      // Replace body arg1 with body arg2
      this.onUpdateBody(arg1, arg2, saveImmediately);
    } else if (arg1 != null && arg2 == null) {
      // Find the first body with the same purpose as arg1,
      // and upsert
      const existing = this.state.currentAnnotation.bodies.find(b => b.purpose === arg1.purpose);
      if (existing)
        this.onUpdateBody(existing, arg1, saveImmediately);
      else
        this.onAppendBody(arg1, saveImmediately);
    }
  }

  /** 
   * Advanced method for applying a batch of body changes
   * in one go (append, remove update), optionally saving
   * immediately afterwards. The argument is an array of 
   * diff objects with the following structure:
   * 
   *   [
   *     { action: 'append', body: bodyToAppend },
   *     { action: 'update', previous: prevBody, updated: updatedBody }
   *     { action: 'remove', body: bodyToRemove },
   * 
   *     // Normal upsert, previous is optional
   *     { action: 'upsert', previous: prevBody, updated: updatedBody }
   * 
   *     // Auto-upsert based on purpose    
   *     { action: 'upsert', body: bodyToUpsert }
   *   ]
   */
  onBatchModify = (diffs, saveImmediately) => {
    // First, find previous bodies for auto upserts
    const autoUpserts = diffs
      .filter(d => d.action === 'upsert' && d.body)
      .map(d => ({
        previous: this.state.currentAnnotation.bodies.find(b => b.purpose === d.body.purpose),
        updated: { ...d.body, ...this.creationMeta(d.body)}
      }));

    const toRemove = diffs
      .filter(d => d.action === 'remove')
      .map(d => d.body);
      
    const toAppend = [
      ...diffs
        .filter(d => (d.action === 'append') || (d.action === 'upsert' && d.updated && !d.previous))
        .map(d => ({ ...d.body, ...this.creationMeta(d.body) })),

      ...autoUpserts
        .filter(d => !d.previous)
        .map(d => d.updated)
    ];

    const toUpdate = [ 
      ...diffs 
        .filter(d => (d.action === 'update') || (d.action === 'upsert' && d.updated && d.previous))
        .map(d => ({ 
          previous: d.previous, 
          updated: { ...d.updated, ...this.creationMeta(d.updated) } 
        })),

      ...autoUpserts
        .filter(d => d.previous)
    ];

    const updatedBodies = [
      // Current bodies
      ...this.state.currentAnnotation.bodies    
        // Remove
        .filter(b => !toRemove.includes(b))

        // Update
        .map(b => {
          const diff = toUpdate.find(t => t.previous === b);
          return diff ? diff.updated : b;
        }),

        // Append
        ...toAppend
    ]
      
    this.updateCurrentAnnotation({ body: updatedBodies }, saveImmediately);
  }

  /**
   * Sets the given property value at the top level of the annotation.
   * @param property property key
   * @param value property value - set to null to delete the property
   */
  onSetProperty = (property, value) => {
    // A list of properties the user is NOT allowed to set
    const isForbidden = [ '@context', 'id', 'type', 'body', 'target' ].includes(property); 

    if (isForbidden)
      throw new Exception(`Cannot set ${property} - not allowed`);

    if (value) {
      this.updateCurrentAnnotation({ [ property ]: value });
    } else {
      const updated = this.currentAnnotation.clone();
      delete updated[ property ];
      this.setState({ currentAnnotation: updated });
    }
  }

  onCancel = () => 
    this.props.onCancel(this.props.annotation);

  onOk = () => {
    // Removes the state payload from all bodies
    const undraft = annotation => 
      annotation.clone({
        body : annotation.bodies.map(({ draft, ...rest }) => rest)
      });

    const { currentAnnotation } = this.state;

    // Current annotation is either a selection (if it was created from 
    // scratch just now) or an annotation (if it existed already and was
    // selected for editing)
    if (currentAnnotation.bodies.length === 0 && !this.props.allowEmpty) {
      if (currentAnnotation.isSelection)
        this.onCancel();
      else 
        this.props.onAnnotationDeleted(this.props.annotation);
    } else {
      if (currentAnnotation.isSelection)
        this.props.onAnnotationCreated(undraft(currentAnnotation).toAnnotation());
      else {
        const undraftedAnnotation = undraft(currentAnnotation)
        const originalNodeId = undraftedAnnotation.domId
        const originalNode = document.querySelector(`span[data-backwards-compatible-id='${originalNodeId}']`)
        if (originalNode) {
          // If they make a change to an existing annotation, update the domId to the new domId
          const newDomId = originalNode.id
          undraftedAnnotation.domId = newDomId
        }
        this.props.onAnnotationUpdated(undraftedAnnotation, this.props.annotation);
      }
    }
  }

  onDelete = () => 
    this.props.onAnnotationDeleted(this.props.annotation);

  render() {
    const { currentAnnotation } = this.state;

    // Use default comment + tag widget unless host app overrides
    const widgets = this.props.widgets ? 
      this.props.widgets.map(getWidget) : DEFAULT_WIDGETS;

    const disabled = this.props.readOnly || (() => {
      if (!currentAnnotation.creator?.id) {
        // Disable all widgets if there isn't a creator with an id
        return true
      } else if (currentAnnotation.creator.id !== this.props.config.user.id) {
        // Disable all widgets if the creator is different than the user
        return true
      }
      return false
    })();

    const hasDelete = currentAnnotation && 
      // annotation has bodies or allowEmpty,
      (currentAnnotation.bodies.length > 0 || this.props.allowEmpty) && // AND
      !this.props.readOnly && // we are not in read-only mode AND
      !currentAnnotation.isSelection && // this is not a selection AND
      !disabled;

    return (
      <div ref={this.element} className='r6o-editor'>
        <div className="r6o-arrow" />
        <div className="r6o-editor-inner">
        <span className="btn btn-link close-annotation" onClick={this.onCancel}>
          <i className="icon icon-x"/>
        </span>
        {widgets.map((widget, idx) =>
          <div key={`widget-${idx}`} className="widget">
            {widget.props.config?.inputLabel && 
              <Label labelName={widget.props.config.inputLabel}/>}
            {React.cloneElement(widget, { 
              ...this.props.config,
              disabled,
              focus: idx === 0,
              annotation : currentAnnotation,
              readOnly : this.props.readOnly,
              env: this.props.env,
              onAppendBody: this.onAppendBody,
              onUpdateBody: this.onUpdateBody,
              onRemoveBody: this.onRemoveBody,
              onUpsertBody: this.onUpsertBody,
              onBatchModify: this.onBatchModify,
              onSetProperty: this.onSetProperty,
              onSaveAndClose: this.onOk
            })}
          </div>
        )}
        
        { this.props.readOnly || disabled ? null : (
          <div 
            className={hasDelete ? "r6o-footer" : "r6o-footer right"}>
            { hasDelete && (
              <button 
                className="btn btn-secondary btn-small delete-annotation" 
                onClick={this.onDelete}>
                Delete
              </button>
            )}
            <button 
              className="btn btn-primary btn-small ok-annotation"
              disabled={currentAnnotation.bodies.length === 0}
              onClick={this.onOk}>{i18n.t('Ok')}</button>
          </div>
        )}
        </div>
      </div>
    )

  }

}
