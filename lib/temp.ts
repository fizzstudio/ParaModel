/*

  // Note that this method will do nothing if the default circumstances aren't met
  private setDefaultAxes(): void {
    const independentAxes = this._axisFacetKeys.filter(
      (key) => this._dataset.facets[key].variableType === 'independent'
    );
    const dependentAxes = this._axisFacetKeys.filter(
      (key) => this._dataset.facets[key].variableType === 'dependent'
    );
    if (
      independentAxes.length === 1 && 
      dependentAxes.length === 1 &&
      (this.horizontalAxisKey === null || this.horizontalAxisKey === independentAxes[0]) &&
      (this.verticalAxisKey === null || this.verticalAxisKey === dependentAxes[0]) 
    ) {
      // NOTE: One (but not both) of these might be rewriting the axis facet key to the same thing
      this.horizontalAxisKey = independentAxes[0];
      this.verticalAxisKey = dependentAxes[0];
    } else if (
      this.facetKeys.includes('x') 
      && this.facetKeys.includes('y')
      && this._facetDisplayTypeMappedByKey['x']?.type === 'axis'
      && this._facetDisplayTypeMappedByKey['y']?.type === 'axis'
      && (this.horizontalAxisKey === null || this.horizontalAxisKey === 'x')
      && (this.verticalAxisKey === null || this.verticalAxisKey === 'y') ) {
        // NOTE: One (but not both) of these might be rewriting the axis facet key to the same thing
        this.horizontalAxisKey === 'x';
        this.verticalAxisKey === 'y';
    }
  }

  */