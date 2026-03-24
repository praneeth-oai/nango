import { Check, ChevronsUpDown, Minus, Search } from 'lucide-react';
import * as React from 'react';

import { Button } from './button';
import { InputGroup, InputGroupAddon, InputGroupInput } from './input-group';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '@/utils/utils';

export interface ComboboxChildOption<TValue extends string = string> {
    value: TValue;
    label: string;
}

export interface ComboboxOption<TValue extends string = string> {
    value: TValue;
    label: string;
    filterValue?: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    tag?: React.ReactNode;
    children?: ComboboxChildOption<TValue>[];
}

interface ComboboxBaseProps<T extends string = string> {
    options: ComboboxOption<T>[];
    disabled?: boolean;
    searchPlaceholder?: string;
    emptyText?: string;
    footer?: React.ReactNode;
    className?: string;
    contentClassName?: string;
    showSearch?: boolean;
}

interface SingleProps<T extends string = string> extends ComboboxBaseProps<T> {
    allowMultiple?: false;
    value: T | '';
    onValueChange: (value: T) => void;
    placeholder: string;
    showCheckbox?: boolean;
    searchValue?: string;
    onSearchValueChange?: (value: string) => void;
    selected?: never;
    label?: never;
    defaultSelect?: never;
    loading?: never;
    onSelectedChange?: never;
}

interface MultiProps<T extends string = string> extends ComboboxBaseProps<T> {
    allowMultiple: true;
    selected: T[];
    onSelectedChange: (selected: T[]) => void;
    label: string;
    defaultSelect?: T[];
    loading?: boolean;
    reorderOnSelect?: boolean;
    value?: never;
    onValueChange?: never;
    placeholder?: never;
    showCheckbox?: never;
    searchValue?: never;
    onSearchValueChange?: never;
}

export type ComboboxProps<T extends string = string> = SingleProps<T> | MultiProps<T>;

function ItemLabel<T extends string>({ opt }: { opt: ComboboxOption<T> | ComboboxChildOption<T> }) {
    const icon = 'icon' in opt ? opt.icon : undefined;
    return (
        <>
            {icon}
            <span className="truncate">{opt.label}</span>
        </>
    );
}

type CheckboxState = 'checked' | 'indeterminate' | 'unchecked';

function getParentCheckboxState<T extends string>(opt: ComboboxOption<T>, selected: T[]): CheckboxState {
    if (!opt.children?.length) {
        return selected.includes(opt.value) ? 'checked' : 'unchecked';
    }
    const childValues = opt.children.map((c) => c.value);
    const selectedChildCount = childValues.filter((cv) => selected.includes(cv)).length;
    if (selectedChildCount === 0 && !selected.includes(opt.value)) return 'unchecked';
    if (selectedChildCount === childValues.length && selected.includes(opt.value)) return 'checked';
    return 'indeterminate';
}

export function Combobox<T extends string = string>(props: ComboboxProps<T>) {
    const { options, disabled, searchPlaceholder = 'Search', emptyText = 'No results found.', footer, className, contentClassName, showSearch = true } = props;

    // Extract mode-specific props upfront for clean hook dependency arrays
    const multiSelected = props.allowMultiple ? props.selected : undefined;
    const multiDefaultSelect = props.allowMultiple ? props.defaultSelect : undefined;
    const multiOnSelectedChange = props.allowMultiple ? props.onSelectedChange : undefined;
    const multiReorderOnSelect = props.allowMultiple ? (props.reorderOnSelect ?? true) : undefined;
    const singleValue = props.allowMultiple ? undefined : props.value;
    const singleOnValueChange = props.allowMultiple ? undefined : props.onValueChange;
    const singleControlledSearch = props.allowMultiple ? undefined : props.searchValue;
    const singleOnSearchValueChange = props.allowMultiple ? undefined : props.onSearchValueChange;
    const singleShowCheckbox = props.allowMultiple ? undefined : props.showCheckbox;

    const [open, setOpen] = React.useState(false);
    const [internalSearch, setInternalSearch] = React.useState('');

    const search = singleControlledSearch !== undefined ? singleControlledSearch : internalSearch;

    const setSearch = React.useCallback(
        (next: string) => {
            if (singleOnSearchValueChange) {
                singleOnSearchValueChange(next);
            } else {
                setInternalSearch(next);
            }
        },
        [singleOnSearchValueChange]
    );

    React.useEffect(() => {
        if (!open) setSearch('');
    }, [open, setSearch]);

    const filteredOptions = React.useMemo(() => {
        const q = search.trim().toLowerCase();

        let filtered: ComboboxOption<T>[];
        if (q) {
            filtered = options.reduce<ComboboxOption<T>[]>((acc, opt) => {
                const parentMatches = (opt.filterValue ?? opt.label).toLowerCase().includes(q);
                if (opt.children?.length) {
                    const matchingChildren = opt.children.filter((c) => c.label.toLowerCase().includes(q));
                    if (parentMatches || matchingChildren.length > 0) {
                        acc.push({ ...opt, children: parentMatches ? opt.children : matchingChildren });
                    }
                } else if (parentMatches) {
                    acc.push(opt);
                }
                return acc;
            }, []);
        } else {
            filtered = options;
        }

        if (props.allowMultiple && multiReorderOnSelect && !q) {
            const selectedSet = new Set(multiSelected);
            const sel: typeof options = [];
            const unsel: typeof options = [];
            filtered.forEach((o) => (selectedSet.has(o.value) ? sel : unsel).push(o));
            return [...sel, ...unsel];
        }

        return filtered;
    }, [options, search, props.allowMultiple, multiSelected, multiReorderOnSelect]);

    const handleSelect = React.useCallback(
        (val: T) => {
            if (multiOnSelectedChange && multiSelected !== undefined) {
                const def = multiDefaultSelect ?? [];

                // Check if this is a parent option with children
                const clickedOpt = options.find((o) => o.value === val);
                if (clickedOpt?.children?.length) {
                    const childValues = clickedOpt.children.map((c) => c.value);
                    const state = getParentCheckboxState(clickedOpt, multiSelected);
                    let next: T[];
                    if (state === 'checked') {
                        // Fully selected → deselect parent + all children
                        next = multiSelected.filter((s) => s !== val && !childValues.includes(s));
                    } else {
                        // Indeterminate or unchecked → select parent + all children
                        next = Array.from(new Set([...multiSelected, val, ...childValues]));
                    }
                    multiOnSelectedChange(next.length === 0 ? [...def] : next);
                    return;
                }

                // Check if this is a child option
                const parentOpt = options.find((o) => o.children?.some((c) => c.value === val));
                if (parentOpt) {
                    const siblingValues = parentOpt.children!.map((c) => c.value);
                    const isSelected = multiSelected.includes(val);
                    let next: T[];
                    if (isSelected) {
                        // Deselect child + parent
                        next = multiSelected.filter((s) => s !== val && s !== parentOpt.value);
                    } else {
                        // Select child; if all siblings now selected, also select parent
                        next = [...multiSelected, val];
                        if (siblingValues.every((sv) => next.includes(sv))) {
                            next = Array.from(new Set([...next, parentOpt.value]));
                        }
                    }
                    multiOnSelectedChange(next.length === 0 ? [...def] : next);
                    return;
                }

                // Regular option
                const isSelected = multiSelected.includes(val);
                const next = isSelected ? multiSelected.filter((s) => s !== val) : [...multiSelected, val];
                multiOnSelectedChange(next.length === 0 ? [...def] : next);
            } else if (singleOnValueChange) {
                singleOnValueChange(val);
                setOpen(false);
            }
        },
        [multiOnSelectedChange, multiSelected, multiDefaultSelect, singleOnValueChange, options]
    );

    const selectedOption = React.useMemo(() => {
        if (props.allowMultiple) return undefined;
        return options.find((opt) => opt.value === singleValue);
    }, [options, props.allowMultiple, singleValue]);

    const isDirty = React.useMemo(() => {
        if (!props.allowMultiple) return false;
        const def = multiDefaultSelect ?? [];
        return (multiSelected?.length ?? 0) !== def.length || multiSelected?.some((s, i) => s !== def[i]) === true;
    }, [props.allowMultiple, multiSelected, multiDefaultSelect]);

    const showCheckbox = props.allowMultiple ? true : (singleShowCheckbox ?? true);

    const trigger = props.allowMultiple ? (
        <Button
            loading={props.loading}
            disabled={disabled}
            variant="ghost"
            size="lg"
            className={cn('border border-border-muted', isDirty && 'bg-btn-tertiary-press', open ? 'bg-bg-subtle' : 'hover:bg-dropdown-bg-hover', className)}
        >
            {props.label}{' '}
            {props.selected.length > 0 && (
                <span className="text-text-primary text-body-small-semi bg-bg-subtle rounded-full h-5 min-w-5 flex items-center justify-center px-2">
                    {props.selected.length}
                </span>
            )}
        </Button>
    ) : (
        <button
            type="button"
            disabled={disabled}
            className={cn(
                'text-[14px] h-8 cursor-pointer flex w-full min-w-0 items-center justify-between gap-1.5 self-stretch rounded-[4px] bg-bg-surface px-2 py-0 text-body-medium-regular leading-[160%] tracking-normal outline-none transition-[color,box-shadow] focus-default hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50',
                selectedOption ? 'text-text-primary' : 'text-text-secondary',
                open ? 'bg-bg-subtle' : 'hover:bg-dropdown-bg-hover',
                className
            )}
        >
            {selectedOption ? (
                <span className="flex items-center gap-2 min-w-0">
                    <ItemLabel opt={selectedOption} />
                    {selectedOption.tag}
                </span>
            ) : (
                <span className="truncate">{props.placeholder}</span>
            )}
            <ChevronsUpDown className="size-3 shrink-0 text-text-secondary" />
        </button>
    );

    const renderOptionRow = (opt: ComboboxOption<T> | ComboboxChildOption<T>, isChild: boolean) => {
        const isParentWithChildren = !isChild && 'children' in opt && opt.children?.length;
        const checkboxState: CheckboxState = isParentWithChildren
            ? getParentCheckboxState(opt, multiSelected ?? [])
            : (multiSelected ?? []).includes(opt.value) || (!props.allowMultiple && opt.value === singleValue)
              ? 'checked'
              : 'unchecked';

        const isHighlighted = checkboxState === 'checked' || checkboxState === 'indeterminate';
        const isDisabled = !isChild && 'disabled' in opt && opt.disabled;

        return (
            <div
                key={opt.value}
                role="option"
                aria-selected={isHighlighted}
                onClick={() => !isDisabled && handleSelect(opt.value)}
                className={cn(
                    'group flex w-full cursor-pointer items-center justify-between rounded-[4px] px-2 py-1 hover:bg-dropdown-bg-hover text-text-secondary hover:text-text-primary',
                    isChild && 'pl-4',
                    isDisabled && 'cursor-not-allowed opacity-50 pointer-events-none',
                    isHighlighted && 'border-[0.5px] border-bg-elevated bg-bg-elevated text-text-primary hover:bg-bg-elevated hover:text-text-primary'
                )}
            >
                <div className="flex min-w-0 items-center gap-2">
                    {showCheckbox && (
                        <span
                            className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded-sm border',
                                checkboxState !== 'unchecked' ? 'border-transparent bg-gray-50 text-gray-1000' : 'border-border-strong bg-transparent'
                            )}
                        >
                            {checkboxState === 'checked' ? (
                                <Check className="size-3.5" />
                            ) : checkboxState === 'indeterminate' ? (
                                <Minus className="size-3.5" />
                            ) : null}
                        </span>
                    )}
                    <div className="flex min-w-0 items-center gap-1 overflow-hidden text-body-medium-regular leading-[160%] tracking-normal">
                        <ItemLabel opt={opt} />
                    </div>
                </div>

                {'tag' in opt && opt.tag ? (
                    <div className="shrink-0">{opt.tag}</div>
                ) : isHighlighted && !showCheckbox ? (
                    <Check className="size-4 shrink-0 text-text-primary" />
                ) : null}
            </div>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align={props.allowMultiple ? 'end' : 'start'}
                sideOffset={0}
                className={cn(
                    'z-[70] flex w-[var(--radix-popover-trigger-width)] flex-col items-start overflow-hidden rounded-[4px] border-[0.5px] border-border-default bg-bg-subtle p-1 pb-0',
                    props.allowMultiple && 'min-w-[312px]',
                    contentClassName
                )}
            >
                {showSearch && (
                    <div className="w-full border-b border-border-muted" onKeyDown={(e) => e.stopPropagation()}>
                        <InputGroup className="h-auto flex-1 justify-between rounded-[4px] border-[0.5px] border-border-muted bg-bg-surface px-2.5 py-1.5">
                            <InputGroupAddon className="p-0 pr-2">
                                <Search className="size-4 text-text-tertiary" />
                            </InputGroupAddon>
                            <InputGroupInput
                                type="text"
                                placeholder={searchPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-auto p-0 text-body-medium-regular text-text-tertiary placeholder:text-text-tertiary"
                            />
                        </InputGroup>
                    </div>
                )}

                <div className="max-h-72 w-full overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt) => (
                            <React.Fragment key={opt.value}>
                                {renderOptionRow(opt, false)}
                                {opt.children?.map((child) => renderOptionRow(child, true))}
                            </React.Fragment>
                        ))
                    ) : (
                        <div className="px-2 py-3 text-center">
                            <p className="text-text-tertiary text-body-small-regular">{emptyText}</p>
                        </div>
                    )}
                </div>

                {footer && <div className="w-full border-t border-border-muted px-1 py-2">{footer}</div>}
            </PopoverContent>
        </Popover>
    );
}
