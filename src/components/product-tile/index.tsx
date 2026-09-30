// This return statement should replace the one in the <Card return
// in the file src\components\product-tile\index.tsx in your SFN respository

const ProductTile = memo(
    forwardRef<HTMLDivElement, ProductTileProps>(
        (
            {
                className,
                product: productProp,
                productId: _productId,
                maxSwatches = PRODUCT_TILE_MAX_SWATCHES,
                selectedVariantColorValue,
                handleProductClick,
                imgAspectRatio,
                showPickupAvailable = false,
                quickAddLabel,
                quickAddPlacement = 'overlay',
                topCategoryName,
                showNavigationArrows: _showNavigationArrows,
                // Page Designer styling props
                objectFit,
                borderRadius,
                boxShadow,
                padding,
                margin,
                fontWeight,
                letterSpacing,
                hoverEffect,
                // Page Designer system props (filter out)
                regionId: _regionId,
                component: _component,
                componentData: _componentData,
                designMetadata: _designMetadata,
                data,
                ...props
            },
            ref
        ) => {
            // Prioritize loader data (Page Designer) over prop (programmatic use)
            const product = (data as ShopperSearch.schemas['ProductSearchHit'] | undefined) || productProp;

            const { config, t, currency, getBadges } = useProductTileContext();
            const { t: tCommon } = useTranslation('common');
            const { isDesignMode } = usePageDesignerMode();

            const productData = useMemo(() => {
                if (!product) return null;
                return {
                    badges: getBadges(product),
                    rating: getProductRating(product),
                };
            }, [product, getBadges]);

            const effectiveImgAspectRatio =
                imgAspectRatio ?? config.global.productListing.defaultProductTileImgAspectRatio;

            const isMasterProd = !!product?.variants;
            const isBundleOrSet = product?.productType?.bundle || product?.productType?.set;
            const representedVariant = isMasterProd
                ? product?.variants?.find((variant) => variant?.productId === product?.representedProduct?.id)
                : undefined;
            const defaultVariantPid = isMasterProd && !isBundleOrSet ? (product?.representedProduct?.id ?? null) : null;

            // use the representedVariant values to get a product for PDP
            const initialVariationValue =
                selectedVariantColorValue !== undefined && selectedVariantColorValue !== null
                    ? selectedVariantColorValue
                    : (representedVariant?.variationValues?.[PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID] ?? undefined);

            // Local swatch selection state — drives image switching and selected ring on swatches.
            // Initialized from the URL-driven prop; updates when the user clicks a swatch on the tile.
            const [selectedAttributeValue, setSelectedAttributeValue] = useState<string | null>(
                initialVariationValue || null
            );

            useEffect(() => {
                if (selectedVariantColorValue !== undefined && selectedVariantColorValue !== null) {
                    setSelectedAttributeValue(selectedVariantColorValue);
                }
            }, [selectedVariantColorValue]);

            // Pre-seed every quick-add swatch from the tile's represented variant, with the
            // locally-selected color overriding the represented variant's color when set.
            const initialVariantSelections = useMemo<Record<string, string> | undefined>(() => {
                const representedVariantSelections: Record<string, string> = {
                    ...(representedVariant?.variationValues ?? {}),
                };
                if (selectedAttributeValue) {
                    representedVariantSelections[PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID] = selectedAttributeValue;
                }
                return Object.keys(representedVariantSelections).length > 0 ? representedVariantSelections : undefined;
            }, [representedVariant, selectedAttributeValue]);

            const variationAttributes = useMemo(
                () => (product ? getDecoratedVariationAttributes(product) : []),
                [product]
            );
            const colorAttributes = variationAttributes.filter(({ id }) => PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID === id);
            const colorValues = (colorAttributes[0]?.values?.slice(0, maxSwatches) ??
                []) as DecoratedVariationAttributeValue[];

            const handleSwatchHover = useCallback(
                (value: string) => {
                    // Read the viewport at hover time rather than subscribing during render: swatch hover is desktop-only,
                    // and a render-time media query would mismatch SSR and force a post-hydration re-render of every tile.
                    if (isDesktopViewport()) {
                        setSelectedAttributeValue(value);
                    }
                },
                [setSelectedAttributeValue]
            );
            const handleClick = useCallback(() => {
                product && handleProductClick?.(product);
            }, [handleProductClick, product]);

            // Gate the lazy wishlist load on first hover/focus/touch of the whole tile, not the
            // heart icon. The heart is `opacity-0 group-hover:opacity-100` — revealed by hovering
            // the tile — so binding the trigger to the heart alone means it never fires until the
            // pointer reaches the heart's box, leaving the revealed heart empty. Idempotent.
            const loadWishlist = useWishlistLoader();
            // Tile intent (pointer/focus/touch anywhere on the tile) both kicks the wishlist data
            // load and eagerly swaps the deferred wishlist button to its real interactive form. For
            // keyboard users this fires when the image link — one tab stop before the button — is
            // focused, so the swap is done before Tab reaches the button (see DeferredWishlistButton
            // `preload`). Without this, focusing the button would remount it and drop focus.
            const [tileEngaged, setTileEngaged] = useState(false);
            const handleTileIntent = useCallback(() => {
                void loadWishlist();
                setTileEngaged(true);
            }, [loadWishlist]);

            const productUrl = createProductUrl(product?.productId ?? '', null, 'color', defaultVariantPid);
            const productName = product?.productName ?? '';

            const pageDesignerStyles = getPageDesignerStyleClasses({
                objectFit,
                borderRadius,
                boxShadow,
                padding,
                margin,
                fontWeight,
                letterSpacing,
                hoverEffect,
            });

            if (!product) {
                // Empty state (W-23908487): a freshly-dropped Product Tile with no product selected
                // yet. Rather than a bespoke text placeholder, we render the tile's *real* card shape
                // (square image surface + product-name heading) with the shared placeholder image and
                // a default "Product" title, so the authoring preview reads as an actual tile and
                // cannot drift from a configured one. This is a Page-Designer *authoring* affordance:
                // it only kicks in during design mode; on the live storefront an unconfigured tile
                // renders nothing, closing the previous "Select a product" leak to shoppers. Mirrors
                // the Content Card's and Category Card's design-mode gate.
                if (!isDesignMode) {
                    return null;
                }
                // Resolve a currency for the placeholder price from the site context, falling back to
                // the first configured site's default. Both can be absent in an authoring preview that
                // isn't wired to a site yet — an empty-string currency would reach `Intl.NumberFormat`
                // and throw `RangeError: Invalid currency code`, crashing the preview. When neither
                // source resolves we simply omit the price row rather than render a broken one.
                const placeholderCurrency = currency ?? config.commerce.sites?.[0]?.defaultCurrency;
                return (
                    <Card
                        ref={ref}
                        className={cn(
                            'product-card group w-full min-w-0 max-w-full overflow-hidden gap-0 py-0',
                            pageDesignerStyles,
                            className
                        )}
                        data-slot="empty-state"
                        {...props}>
                        {/* Image area — mirrors the configured tile's square image surface. */}
                        <div className="product-image relative">
                            <div className="relative w-full aspect-square overflow-hidden bg-muted">
                                <DynamicImage
                                    src={resolveAssetUrl(EMPTY_STATE_PLACEHOLDER_SRC)}
                                    // Decorative: the default "Product" title is rendered as a heading
                                    // below, so an alt would make a screen reader read it twice.
                                    alt=""
                                    className="w-full h-full"
                                    imageProps={{ className: 'w-full h-full object-cover' }}
                                    widths={carouselItemImageWidths}
                                    loading="eager"
                                />
                            </div>
                        </div>

                        {/* Info section — mirrors the configured tile's product name, star rating, and
                            price rows (skipping the data-driven store/category/SKU lines), so the
                            authoring preview reads as a fully-populated tile rather than a bare title.
                            Reuses the real `StarRating` and `CurrentPrice` so the placeholder cannot
                            drift from a configured tile: black stars (`text-foreground`, matching real
                            tiles) at an empty 0/0 rating, and a currency-formatted zero price (never a
                            hardcoded "$0.00") via the same formatter the live price uses. */}
                        <div className="relative p-4">
                            <h3 className="text-lg font-semibold leading-[120%] tracking-[-0.45px] text-card-foreground mb-2">
                                {tCommon('productTile.emptyTitle')}
                            </h3>
                            <div className="mb-2">
                                <StarRating rating={0} reviewCount={0} starSize="sm" starClassName="text-foreground" />
                            </div>
                            {placeholderCurrency && (
                                <CurrentPrice
                                    price={0}
                                    currency={placeholderCurrency}
                                    className="text-lg font-semibold leading-[120%] tracking-[-0.45px] text-card-foreground"
                                />
                            )}
                        </div>
                    </Card>
                );
            }

            return (
                <Card
                    ref={ref}
                    className={cn(
                        'product-card group w-full min-w-0 max-w-full cursor-pointer overflow-hidden gap-0 py-0',
                        pageDesignerStyles,
                        className
                    )}
                    onPointerEnter={handleTileIntent}
                    onFocus={handleTileIntent}
                    onTouchStart={handleTileIntent}
                    {...props}>
                    {/* Image area */}
                    <div className="product-image relative">
                        <div className="relative w-full overflow-hidden">
                            <ProductImageContainer
                                product={product}
                                selectedColorValue={
                                    PRODUCT_TILE_SELECTABLE_ATTRIBUTE_ID === 'color' ? selectedAttributeValue : null
                                }
                                imgAspectRatio={effectiveImgAspectRatio}
                                className="w-full aspect-square [&_img]:object-cover! [&_img]:h-full! [&_img]:max-w-full! [&_img]:mx-auto!"
                                handleProductClick={handleProductClick}
                            />
                            <UITarget targetId="sfcc.plp.shipping.deliveryEstimate" />

                            {/*
                             * Clickable product link over the image. This is the tile's keyboard
                             * entry point (a real tab stop with an accessible name): focusing it
                             * fires `group-focus-within`, which reveals the wishlist and quick-add
                             * controls before forward-Tab reaches them in DOM order — without it,
                             * those controls stay `invisible` (removed from tab order) and keyboard
                             * users can never reach them (WCAG 2.1.1). The product name link below
                             * is `tabIndex={-1}` so this does not add a second tab stop.
                             */}
                            <Link
                                to={productUrl}
                                className="absolute inset-0 z-[1] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                aria-label={productName}
                                onClick={handleClick}
                            />

                            {/* Badges — top-left */}
                            {productData?.badges.hasBadges && (
                                <div className="absolute top-2 left-2 flex flex-col items-start gap-1 z-20">
                                    {productData.badges.badges.map((badge) => (
                                        <span
                                            key={badge.label}
                                            data-slot="badge"
                                            className="px-2 py-1 text-xs font-semibold uppercase inline-block bg-foreground text-background leading-none rounded-ui">
                                            {badge.label}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Action icons — top-right */}
                            <div className="absolute top-2 right-2 flex flex-col items-end gap-2 z-20">
                                {showPickupAvailable && (
                                    <div
                                        className="group/pickup relative"
                                        role="img"
                                        aria-label={t('pickupAvailable')}
                                        data-testid="pickup-available-indicator">
                                        <div className="w-9 h-9 p-2 bg-muted text-muted-foreground flex items-center justify-center">
                                            <PickupIcon className="w-4 h-4" aria-hidden="true" />
                                        </div>
                                        <div className="absolute right-0 top-full mt-1 z-50 opacity-0 group-hover/pickup:opacity-100 transition-opacity duration-200 pointer-events-none">
                                            <div className="bg-foreground text-background text-xs font-medium px-2 py-1 whitespace-nowrap shadow-lg">
                                                {t('pickupAvailable')}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/*
                                 * `invisible` (not just `opacity-0`) so the wishlist button is removed
                                 * from the accessibility tree and tab order while hidden — an opacity-0
                                 * control still gets announced and focused, so a screen reader hears
                                 * "Add to wishlist" on every resting tile (WCAG 1.3.1). Revealed on tile
                                 * hover and on keyboard focus reaching the tile (group-focus-within).
                                 */}
                                <div className="invisible opacity-0 transition-[opacity,visibility] duration-300 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                                    <DeferredWishlistButton
                                        product={product}
                                        surface="plp"
                                        size="sm"
                                        preload={tileEngaged}
                                        className="relative top-auto right-auto z-20 bg-muted hover:bg-background shadow-sm border-0"
                                    />
                                </div>
                            </div>

                            {/* Hover overlay — subtle dark tint */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-opacity duration-300 pointer-events-none" />

                            {/* Quick Add button — `invisible` at rest for the same reason as the
                                wishlist button above: an opacity-0 control stays in the a11y tree and
                                tab order, so it is announced on every resting tile (WCAG 1.3.1).
                                Rendered here only for the default overlay placement; the `inline`
                                placement renders it in-flow at the bottom of the info section below. */}
                            {quickAddPlacement === 'overlay' && (
                                <div className="absolute bottom-4 left-0 right-0 px-4 invisible opacity-0 transition-[opacity,visibility] duration-300 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 z-20">
                                    <QuickAddButton
                                        productId={product.productId ?? ''}
                                        productName={productName}
                                        selectedColorValue={selectedAttributeValue}
                                        initialVariantSelections={initialVariantSelections}
                                        label={quickAddLabel ?? t('quickAdd')}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Info section */}
                    <div className="relative p-4">
                        {/* Color swatches */}
                        {colorValues.length > 0 && (
                            <div>
                                <Suspense fallback={<ProductTileSwatchesSkeleton count={maxSwatches} />}>
                                    <LazySwatches
                                        colorValues={colorValues}
                                        selectedAttributeValue={selectedAttributeValue}
                                        onSwatchHover={handleSwatchHover}
                                        onSwatchClick={handleClick}
                                        productName={productName}
                                        totalColorCount={colorAttributes[0]?.values?.length ?? colorValues.length}
                                        maxSwatches={maxSwatches}
                                        productHref={productUrl}
                                    />
                                </Suspense>
                            </div>
                        )}

                        {/* Store name */}
                        <p className="text-sm font-normal leading-normal text-muted-foreground mb-1">
                            {config.global.branding.name}
                        </p>

                        {/* Top category */}
                        {topCategoryName && (
                            <p className="text-sm font-normal leading-normal text-muted-foreground mb-1">
                                {topCategoryName}
                            </p>
                        )}

                        {/* Product name — the heading carries the product's accessible name directly.
                            The tile's single product link (keyboard + AT) is the image overlay above;
                            this inner link is a mouse-only convenience, so it is `aria-hidden` and
                            `tabIndex={-1}` to avoid duplicating that link in the accessibility tree. */}
                        <h3
                            aria-label={productName}
                            className="text-lg font-semibold leading-[120%] tracking-[-0.45px] text-card-foreground mb-2">
                            <Link
                                to={productUrl}
                                className="hover:underline"
                                tabIndex={-1}
                                aria-hidden="true"
                                onClick={handleClick}>
                                {productName}
                            </Link>
                        </h3>

                        {/* SKU */}
                        {product.productId && (
                            <p
                                className="text-sm font-normal leading-normal text-muted-foreground mb-1"
                                data-testid="product-tile-sku">
                                {t('sku')} {product.productId}
                            </p>
                        )}

                        {/* Star ratings */}
                        <div className="mb-2">
                            <StarRating
                                rating={productData?.rating.rating ?? 0}
                                reviewCount={productData?.rating.reviewCount ?? 0}
                                starSize="sm"
                                starClassName="text-foreground"
                                showRatingLink
                                ratingLinkTemplate="({count})"
                                ratingLinkClassName="text-xs text-muted-foreground"
                            />
                        </div>
                        <UITarget targetId="sfcc.productCard.reviews.rating" />

                        {/* Price */}
                        <div>
                            <ProductPrice
                                type="unit"
                                product={product}
                                currency={currency ?? config.commerce.sites?.[0]?.defaultCurrency ?? ''}
                                labelForA11y={(product?.productName ?? product?.productId) || ''}
                                currentPriceProps={{
                                    className:
                                        'text-lg font-semibold leading-[120%] tracking-[-0.45px] text-card-foreground',
                                }}
                                listPriceProps={{
                                    className: 'text-muted-foreground text-sm leading-none line-through',
                                }}
                                promoCalloutProps={{
                                    className: 'text-xs text-active-foreground mt-1',
                                }}
                                className="text-sm"
                            />
                        </div>
                        <UITarget targetId="sfcc.productCard.loyalty.points" />
                        <UITarget targetId="sfcc.productCard.bnpl.message" />

                        {/* Inline Quick-Add — always-visible, full-width button at the bottom of the
                            tile (opt-in via quickAddPlacement="inline"; the overlay above is skipped). */}
                        {quickAddPlacement === 'inline' && (
                            <div className="mt-3">
                                <QuickAddButton
                                    productId={product.productId ?? ''}
                                    productName={productName}
                                    selectedColorValue={selectedAttributeValue}
                                    initialVariantSelections={initialVariantSelections}
                                    label={quickAddLabel ?? t('quickAdd')}
                                />
                            </div>
                        )}
                    </div>
                </Card>
            );
        }
    )
);

ProductTile.displayName = 'ProductTile';