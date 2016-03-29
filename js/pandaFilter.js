/**
   * Panda filter
   * @author: Vlad Fang
   * Animations are inspired by isotope.js, thank you guys :)
   * Free to use (04.2016)
   */
;(function(factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery'], factory);
    } else if (typeof module === 'object' && module.exports) {
        factory(require('jquery'));
    } else {
        // Browser globals
        factory(window.jQuery);
    }
}(function($) {
   /**
    * Creates a filter.
    * @class The Panda Filter.
    * @public
    * @param {HTMLElement|jQuery} element - The element to create the filter for.
    * @param {Object} [options] - The options
    */
  function Panda(element, options) {

    /**
     * Current settings for the filter.
     * @public
     */
    this.settings = null;

    /**
     * Proxied event handlers.
     * @protected
     */
    this._handlers = {};

    /**
     * Animation speed in milliseconds.
     * @protected
     */
    this._speed = null;

    /**
     * Current width of the plugin element.
     */
    this._width = null;

    /**
     * Widths of all items.
     */
    this._widths = [];

    /**
     * Current options set by the caller including defaults.
     * @public
     */
    this.options = $.extend({}, Panda.Defaults, options);

    /**
     * Plugin element.
     * @public
     */
    this.$element = $(element);

    this._categoryButtons = this.$element.find('.panda-filter-category-button');

    this._sortButtons = this.$element.find('.panda-filter-sorting-button');

    /**
     * All filter items items.
     * @protected
     */
    this._items = this.$element.find('.panda-filter-item');

    this._itemsList = this.$element.find('.items-list');

    /**
     * A template for filter items after ajax success
     * @protected
     */
    this._itemTemplate = this.$element.find('.panda-filter-item:first-child');

    this._resetEl = this.$element.find('.panda-filter-reset');

    this._loadMoreEl = this.$element.find('.panda-filter-load-more');

    this._noResultEl = this.$element.find('.panda-filter-no-result');

    this._clearSearchEl = this.$element.find('.panda-filter-clear-search');

    this._activeListEl = this.$element.find('.panda-filter-active-categories-list');

    this._searchEl = this.$element.find('.panda-filter-search');

    this._filterTypes = [];

    this._activeItems = this._items;

    this._tempSearch = this._activeItems;

    this.initialize();
  }

  /**
   * Default options for the filter.
   * @public
   */
  Panda.Defaults = {
    matchBy: 'and',
    showActive: false,

    search: {
      enable: true,
      event: 'keyup',
      seechEl: '.title'
    },

    showAvailable: false,
    disableNotAvailable: true,

    rowItems: true,

    animationClass: 'scale',

    loadMore: {},

    sorting: true
  };

  Panda.prototype.initialize = function() {
    if (this.options.sorting) this.sortItems();
    
    if (this.options.showAvailable) this.countAvailableItems();

    this.bindEvents();
  };

  // @todo use .each function for every event
  Panda.prototype.bindEvents = function() {
    var that = this;

    this._loadMoreEl.on('click', function(event) {
      event.preventDefault();

      that.loadMoreItems();
    });

    this._resetEl.on('click', function(event) {
      event.preventDefault();

      that.clearSearch();
      that.clearFilters();

      if (that.options.showAvailable) that.countAvailableItems();

      if (that.options.showActive) {
        that._activeListEl.find('a').remove(); // Temporary
      }
    });

    this._searchEl.bind(this.options.search.event, function(event) {
      event.preventDefault();

      that.searchItems(this);
    });

    this._categoryButtons.on('click', function(event) {
      event.preventDefault();

      that.filterItems(this);
    });

    this._sortButtons.on('click', function(event) {
      event.preventDefault();

      that.sortItems(this);
    });

    this._clearSearchEl.on('click', function(event) {
      event.preventDefault();

      that.clearSearch();

      that.matchItems(that.getFilterTypeArray());
    });
  };

  Panda.prototype.loadMoreItems = function() {
    var that     = this,
        defaults = {
          url: that._loadMoreEl.data('url'),
          type: 'get',
          dataType: 'json',
          success: function(data) {
            for (var i in data) {
              var item  = data[i],
                  newEl = that._itemTemplate.clone();

              for (var key in item) {
                if (typeof newEl.attr('data-filter-' + key) !== 'undefined') {
                  newEl.attr('data-filter-' + key, item[key]);
                }

                newEl.find('.' + key).text(item[key]); // Fill up text to a related element
              }

              newEl
                .attr('style', '') // Refresh items position
                .addClass('new-item')
                .appendTo(that._itemsList);

              that._activeItems.push(newEl[0]);
              that._items.push(newEl[0]);
            }

            if (!that._filterTypes.length) {
              that.gridElements();
            } else {
              that.gridElements($('.panda-filter-item.matched, .new-item'));
            }

            $('.new-item').removeClass('new-item').addClass('matched');

            that.countAvailableItems();
          }
        };

    this.options.loadMore = $.extend(true, defaults, this.options.loadMore);

    $.ajax(this.options.loadMore);
  }

  /**
   * Sorts items by a given value
   * @param {Object} elementContext - The 'this' context of binded element
   */
  Panda.prototype.sortItems = function(elementContext) {
    var defaultSort = $('.panda-filter-sorting-button.active').data('sorting-type');

    var self;

    if (typeof $(elementContext)[0] !== 'undefined') { // Check if function was called on button
      self = $(elementContext);

      this._sortButtons.removeClass('active');
      self.addClass('active');
    }

    var sortingType    = (arguments[0]) ? self.data('sorting-type') : defaultSort,
        sortTypeTokens = sortingType.split('-'),
        sortingPrefix  = 'data-filter-',
        sortingTarget  = sortingPrefix + sortTypeTokens[1], // Get second value from tokens
        sortByType     = sortTypeTokens[0];

    var tempSortArray = this._activeItems.sort(function(a, b) {
      var currentElValue = parseInt(a.getAttribute(sortingTarget)),
          nextElValue    = parseInt(b.getAttribute(sortingTarget));

      if (sortByType === 'min') {
        return  currentElValue - nextElValue;
      } else if (sortByType === 'max') {
        return nextElValue - currentElValue;
      }
    });

    this.setActiveItems(tempSortArray);

    this._activeItems.appendTo(this._itemsList);

    this.gridElements(this._activeItems);
  }

  /**
   * Searches items on search input action
   * Fills temporary matchedItems array
   * @param {Object} elementContext - The 'this' context of binded element
   */
  Panda.prototype.searchItems = function(elementContext) {
    var inputText    = $.trim($(elementContext).val().toLowerCase()),
        matchedItems = [];

    var that = this;

    $(this._activeItems).each(function() {
      var self    = $(this),
          seechEl = self.find(that.options.search.seechEl);

      seechEl.each(function() {
        var innerText = $(this).text().toLowerCase();

        if (innerText.indexOf(inputText) > -1) {
          matchedItems.push(self.get(0));

          return;
        }
      });
    });

    // Compare current shown items with matched ones
    if (!this.compareArrays(this._tempSearch, matchedItems)) {
      if (this.options.showAvailable) this.countAvailableItems(matchedItems);

      this.animateItems(matchedItems);
    }

    // Fill tempArray to be actual matched items
    if (this._tempSearch != matchedItems) this._tempSearch = matchedItems;
  }

  /*
   * Filters items by a given category, fills temporary array of active categories \
   * \ which is given as a parameter to a matchItems() function
   * @param {Object} elementContext - The 'this' context of binded element
   */
  Panda.prototype.filterItems = function(elementContext) {
    var self           = $(elementContext),
        filterCategory = self.data('filter-category'),
        filterTypeTemp = this.getFilterTypeArray();

    self.toggleClass('active');

    // TODO: refactor all this shit
    if (this.options.showActive) {
      var currentCategory = self.clone(true);
      var clonedItem = this._activeListEl.find('.panda-filter-category-button[data-filter-category="' + filterCategory + '"]');
      var relatedItem = $('.panda-filter-category-button[data-filter-category="' + filterCategory + '"]');

      if (!self.parents('.panda-filter-active-categories-list').length) { // Check if clicked element is in a list of active ones
        if (!clonedItem.length) { // Check if such category is not there already
          var categoryGroup   = self.data('filter-category-group'),
              categoryGroupEl = $('.category-filter .panda-filter-category-group[data-filter-category-group="' + categoryGroup + '"]');

          if (typeof categoryGroup !== 'undefined') {
            var currentCategoryGroup = categoryGroupEl.clone(),
                clonedGroup          = this._activeListEl.find('.panda-filter-category-group[data-filter-category-group="' + categoryGroup + '"]');

            if (!clonedGroup.length) {
              currentCategoryGroup.append(currentCategory).appendTo(this._activeListEl);
            } else {
              clonedGroup.append(currentCategory);
            }
          } else {
            this._activeListEl.append(currentCategory);
          }
        } else {
          clonedItem.remove(); // Temporary solution
        }
      } else {
        relatedItem.removeClass('active');
        self.remove(); // Temporary solution
      }
    }
    // shit ends

    // If filter is already active
    if (filterTypeTemp.indexOf(filterCategory) > -1) {
      filterTypeTemp.splice($.inArray(filterCategory, filterTypeTemp), 1); // Remove filter type from filterTypes array

      if (!filterTypeTemp.length) {
        filterTypeTemp.push('all'); // If no active filter - show all
        
        this.clearSearch(); // Clear search filter either
      }
    } else {
      filterTypeTemp.push(filterCategory); // Add filter type to filter type array
    }

    this.matchItems(filterTypeTemp);

    if (this.options.showAvailable) this.countAvailableItems(this._activeItems);
  };

  Panda.prototype.matchItems = function(filterTypeArray) {
    // If no active filter selected - Clear @filterTypeArray to show all items
    if (filterTypeArray[0] === 'all') {
      this.clearFilters();

      return; // Stop code executing
    }

    this._items = this.getAllFilterItems();

    var matchedItems = (this.options.matchBy === 'and') ? this.matchItemsByAnd(this._items, filterTypeArray)
                                                        : this.matchItemsByOr(this._items, filterTypeArray);

    this.setActiveItems(matchedItems);

    this.animateItems(matchedItems);
  };

  /**
   * Matches items by "&&" algorithm
   * @param {Array} items - items, through which we iterate and match by given @filterType
   * @param {Array} filterType - array of filter values, f.e categories.
   */
  Panda.prototype.matchItemsByAnd = function(items, filterType) {
    var matchedItems = [];
    $(items).each(function() {
      var item           = $(this),
          itemCategories = item.data('filter-category').replace(' ', '').split(','); // Split categories into array

      var matchedFilterCount = 0;

      for (var i in itemCategories) {
        for (var j in filterType) {
          var type = filterType[j];

          if (itemCategories[i] === type) {
            matchedFilterCount++;

            if (matchedFilterCount == filterType.length) {
              matchedItems.push(item[0]); // !important: Push only DOM element instead of whole $ object

              return;
            }
          }
        }
      }
    });

    return matchedItems;
  };

  /**
   * Counts available items of category and sets them into data-attribute of iterated item
   * @param {Array} itemsToCount - Array of category buttons
   */
  Panda.prototype.countAvailableItems = function(itemsToCount) {
    var that  = this,
        items = (typeof itemsToCount !== 'undefined') ? itemsToCount : this._activeItems;

    this._categoryButtons.addClass('count-available-items');

    this._categoryButtons.each(function() {
      var availableItems = 0;

      var button         = $(this),
          buttonCategory = button.data('filter-category');

      $(items).each(function() {
        var item         = $(this),
            itemCategory = item.data('filter-category');

        if (itemCategory.indexOf(buttonCategory) > -1) {
          availableItems++;
        }
      });


      if (that.options.disableNotAvailable) {
        if (!availableItems) {
          button.addClass('unavailable');
        } else {
          button.removeClass('unavailable');
        }
      }

      button.attr('data-filter-category-available', availableItems);

    });
  }

  Panda.prototype.animateItems = function(itemsToAnimate) {
    this._items = this.getAllFilterItems();

    this._items.removeClass('matched unmatched');

    if (this._items.length !== itemsToAnimate.length) {
      if (itemsToAnimate.length) {
        this.resultsFound();
        $(itemsToAnimate).addClass('matched');

        this._items.not('.matched').addClass('unmatched'); 

      } else if (!itemsToAnimate.length) {
        this._items.addClass('unmatched'); 
        this.noResult();
      }
    } else {
      this.resultsFound();
      this._items.addClass('matched');
    }
    
    this.gridElements('.panda-filter-item.matched');
  };

  Panda.prototype.gridElements = function(elements) {
    var that            = this,
        gridItems       = (elements) ? that._itemsList.find(elements) : that._itemsList.find('.panda-filter-item'),
        maxItemsPerRow  = Math.ceil(parseFloat(that._itemsList.width() / gridItems.outerWidth())),
        maxRows         = Math.ceil(gridItems.length / maxItemsPerRow),
        rowCounter      = 1,
        itemCounter     = 1,
        totalGridHeight = 0,
        maxItemHeight;

    var lastgridItemOffset = {left: 0, top: 0};

    if (that.options.rowItems) {
      var itemsHeights = [];
    }

    gridItems.each(function() {
      var self       = $(this),
          itemWidth  = self.outerWidth(), 
          itemHeight = self.outerHeight(); 

      self.css({
        top: lastgridItemOffset.top,
        left: lastgridItemOffset.left
      });

      lastgridItemOffset.left += itemWidth;

      if (that.options.rowItems) itemsHeights.push(itemHeight);

      if (itemCounter == maxItemsPerRow) {
        maxItemHeight = (that.options.rowItems) ? Math.max.apply(null, itemsHeights) : itemHeight;

        lastgridItemOffset.top += maxItemHeight;
        lastgridItemOffset.left = 0;
        totalGridHeight += maxItemHeight;

        itemCounter = 1;
        itemsHeights = [];
        rowCounter++;
      } else {
        // Last row check
        if (rowCounter == maxRows && gridItems.index(self) == gridItems.length - 1) { 
          maxItemHeight = (that.options.rowItems) ? Math.max.apply(null, itemsHeights) : itemHeight;

          totalGridHeight += maxItemHeight;
        }

        itemCounter++;
      }
    });

    that._itemsList.height(totalGridHeight); 
  };

  Panda.prototype.clearFilters = function() {
    this._filterTypes = [];

    this._categoryButtons.removeClass('active');

    this._activeListEl.find('.filter-up-category-group').remove(); // Temporary solution

    this._items = this.getAllFilterItems();

    if (this.options.showAvailable) this.countAvailableItems(this._items);

    this.animateItems(this._items);
  };

  /**
   * Clears search values (search input, search array)
   */
  Panda.prototype.clearSearch = function() {
    this._searchEl.val('');
    this._tempSearch = [];

    if (!this._filterTypes.length) { // matchItems only when any filters active
      this._filterTypes = ['all'];
    }

    this.setActiveItems(this._items);
  };

  Panda.prototype.noResult = function() {
    this._noResultEl.addClass('scaleIn');
      //globals.noItemsFound = false;
  };

  Panda.prototype.resultsFound = function() {
    this._noResultEl.removeClass('scaleIn');
      //globals.noItemsFound = false;
  };

  /**
   * Sets activeItems array to a new given newActiveItems parameter
   * @param {Array} newActiveItems - jquery Objects (DOM nodes) / items, which are matched and shown on UI
   */
  Panda.prototype.setActiveItems = function(newActiveItems) {
    this._activeItems = $(newActiveItems);
  };

  /**
   * Gets global filterTypeArray
   * @returns {Array}
   */
  Panda.prototype.getFilterTypeArray = function() {
    return this._filterTypes;
  };

  /**
   * Gets current filter items
   * @returns {Array}
   */
  Panda.prototype.getAllFilterItems = function() {
    return this.$element.find('.panda-filter-item');
  };

  /**
   * Compares given arrays to be equal with each other
   * @param {Array} arr1
   * @param {Array} arr2
   * @returns {boolean}
   */
  Panda.prototype.compareArrays = function(arr1, arr2) {
    return $(arr1).not(arr2).length === 0 && $(arr2).not(arr1).length === 0;
  };

  $.fn.pandaFilter = function(option) {
    return this.each(function() {
      new Panda(this, typeof option == 'object' && option);
    });
  };
}));