import {useState, FC, useRef, Dispatch, DragEvent, useMemo} from 'react';
import {Pane} from './pane';
import styled from 'styled-components';
import {ErrorMessage} from '../styled';
import {AccentSelect} from '../inputs/accent-select';
import {AccentSlider} from '../inputs/accent-slider';
import {AccentUploadButton} from '../inputs/accent-upload-button';
import Layouts from '../Layouts';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faBook, faUpload, faXmark} from '@fortawesome/free-solid-svg-icons';
import {DefinitionVersionMap} from '@the-via/reader';
import type {DefinitionVersion} from '@the-via/reader';
import {resolveDefinitionName} from 'src/utils/definition-name';
import {
  DefinitionImportError,
  ParsedDefinition,
  parseDefinitionText,
} from 'src/utils/definition-import';
import {
  ControlRow,
  Label,
  SubLabel,
  Detail,
  IndentedControlRow,
  SinglePaneFlexCell,
  Grid,
  SpanOverflowCell,
  MenuCell,
  Row,
  IconContainer,
} from './grid';
import {useDispatch} from 'react-redux';
import {selectDevice, ensureSupportedIds} from 'src/store/devicesSlice';
import {reloadConnectedDevices} from 'src/store/devicesThunks';
import {useAppSelector} from 'src/store/hooks';
import {
  getCustomDefinitions,
  loadCustomDefinitions,
  storeCustomDefinitions,
  unloadCustomDefinition,
} from 'src/store/definitionsSlice';
import {
  getSelectedDefinitionIndex,
  getShowMatrix,
  updateSelectedDefinitionIndex,
  updateSelectedOptionKeys,
  updateShowMatrix,
} from 'src/store/designSlice';
import {MenuContainer} from './configure-panes/custom/menu-generator';
import {MenuTooltip} from '../inputs/tooltip';
import {MessageDialog} from '../inputs/message-dialog';
import {IconButtonUnfilledContainer} from '../inputs/icon-button';
import {formatNumberAsHex} from 'src/utils/format';
import {
  getDesignDefinitionVersion,
  updateDesignDefinitionVersion,
  setShowDesignTab,
  setShowDesignTabConfirmationNotice,
} from 'src/store/settingsSlice';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'wouter';

let designWarningSeen = Number(localStorage.getItem('designWarningSeen') || 0);
let hideDesignWarning =
  sessionStorage.getItem('hideDesignWarning') || designWarningSeen > 4;

const DesignErrorMessage = styled(ErrorMessage)`
  margin: 0;
  font-style: italic;
`;

const DesignInfoMessage = styled.div`
  margin: 0;
  color: var(--color_success);
  font-size: 13px;
  line-height: 1.5;
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

const DesignPane = styled(Pane)`
  display: grid;
  max-width: 100vw;
  grid-template-columns: 100vw;
  grid-template-rows: min-content;
`;

const UploadIcon = styled.div`
  height: 200px;
  width: 50%;
  cursor: pointer;
  max-width: 560px;
  border-radius: 6px;
  margin: 50px 10px;
  animation-duration: 1.5s;
  animation-name: border-glow;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: ease-in-out;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    color: transparent;
    stroke-width: 8px;
    animation-duration: 1.5s;
    animation-name: text-glow;
    animation-iteration-count: infinite;
    animation-direction: alternate;
    animation-timing-function: ease-in-out;
    font-size: 100px;
  }
`;

const makeReaderPromise = (file: File): Promise<[string, string]> => {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!reader.result) return rej();
      res([file.name, reader.result.toString()]);
    };
    reader.onerror = rej;
    reader.onabort = rej;
    reader.readAsBinaryString(file);
  });
};

// Import definitions with automatic generation detection. The explicit v2/v3
// switch is kept only as a display filter for already-loaded drafts; a dropped
// file is always recognised by its own shape, not by the toggle.
function importDefinitions(
  files: File[],
  _version: DefinitionVersion,
  dispatch: Dispatch<any>,
  setErrors: (errors: string[]) => void,
  setImported: (message: string | null) => void,
) {
  Promise.all(files.map(makeReaderPromise)).then((results) => {
    const errors: string[] = [];
    const parsed: ParsedDefinition[] = [];
    setErrors([]);
    setImported(null);

    results.forEach(([fileName, result]) => {
      try {
        const definitions = parseDefinitionText(result.toString());
        parsed.push(...definitions);
        const notes = definitions.flatMap((entry) => entry.notes);
        if (notes.length) {
          setImported(`${fileName}：${Array.from(new Set(notes)).join('；')}`);
        }
      } catch (error) {
        if (error instanceof DefinitionImportError) {
          errors.push(`${fileName}：${error.detail}`);
        } else if (error instanceof Error) {
          errors.push(`${fileName}：${error.message}`);
        } else {
          errors.push(`${fileName}：${String(error)}`);
        }
      }
    });

    if (errors.length) {
      setErrors(errors);
      return;
    }
    if (!parsed.length) {
      return;
    }

    (['v2', 'v3'] as DefinitionVersion[]).forEach((version) => {
      const definitions = parsed
        .filter((entry) => entry.version === version)
        .map((entry) => entry.definition);
      if (!definitions.length) {
        return;
      }
      dispatch(loadCustomDefinitions({definitions, version}));
      dispatch(storeCustomDefinitions({definitions, version}));
      dispatch(
        ensureSupportedIds({
          productIds: definitions.map((definition) => definition.vendorProductId),
          version,
        }),
      );
    });

    // Show the generation we actually detected instead of making the user
    // discover the (deprecated) toggle.
    const firstVersion = parsed[0].version;
    dispatch(updateDesignDefinitionVersion(firstVersion));
    setImported(
      `Detected ${firstVersion.toUpperCase()} definition automatically${
        parsed.length > 1 ? ` (${parsed.length} files)` : ''
      }`,
    );
    dispatch(selectDevice(null));
    dispatch(reloadConnectedDevices());
  });
}

function onDrop(
  evt: DragEvent<HTMLElement>,
  version: DefinitionVersion,
  dispatch: Dispatch<any>,
  setErrors: (errors: string[]) => void,
  setImported: (message: string | null) => void,
) {
  evt.preventDefault();
  const {dataTransfer} = evt;
  if (dataTransfer?.items) {
    const items = Array.from(dataTransfer.items)
      .filter((item) => {
        return item.kind === 'file' && item.type === 'application/json';
      })
      .map((item) => item.getAsFile()) // Use DataTransferItemList interface to access the file(s)
      .filter((item) => item !== null);
    if (items.length) {
      importDefinitions(
        items as File[],
        version,
        dispatch,
        setErrors,
        setImported,
      );
    }
  }
}

export const DesignTab: FC = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const [, setLocation] = useLocation();
  const localDefinitions = Object.values(useAppSelector(getCustomDefinitions));
  const definitionVersion = useAppSelector(getDesignDefinitionVersion);
  const selectedDefinitionIndex = useAppSelector(getSelectedDefinitionIndex);
  const showMatrix = useAppSelector(getShowMatrix);
  const [errors, setErrors] = useState<string[]>([]);
  const [imported, setImported] = useState<string | null>(null);
  const versionDefinitions: DefinitionVersionMap[] = useMemo(
    () =>
      localDefinitions.filter(
        (definitionMap) => definitionMap[definitionVersion],
      ),
    [localDefinitions, definitionVersion],
  );

  const options = versionDefinitions.map((definitionMap, index) => ({
    label: resolveDefinitionName(definitionMap[definitionVersion].name),
    value: index.toString(),
  }));

  const flexRef = useRef(null);
  const definition =
    versionDefinitions[selectedDefinitionIndex] &&
    versionDefinitions[selectedDefinitionIndex][definitionVersion];
  const uploadButton = useRef<HTMLInputElement>();
  return (
    <DesignPane
      onDragOver={(evt: DragEvent) => {
        evt.dataTransfer.effectAllowed = 'copyMove';
        evt.dataTransfer.dropEffect = 'none';
        evt.preventDefault();
        evt.stopPropagation();
      }}
    >
      <MessageDialog
        isOpen={!hideDesignWarning}
        onConfirm={() => {
          sessionStorage.setItem('hideDesignWarning', '1');
          hideDesignWarning = '1';
          designWarningSeen = designWarningSeen + 1;
          localStorage.setItem('designWarningSeen', `${designWarningSeen}`);
        }}
        onCancel={() => {
          dispatch(setShowDesignTab(false));
          dispatch(setShowDesignTabConfirmationNotice(true));
          setLocation('/settings');
        }}
      >
        {t(
          "Use the Design tab to sideload a keyboard definition JSON file provided by your keyboard's manufacturer or vendor.\n\nThis feature is intended for development and troubleshooting.",
        )}
      </MessageDialog>
      <SinglePaneFlexCell ref={flexRef}>
        {!definition && (
          <UploadIcon
            onClick={() => {
              uploadButton.current && uploadButton.current.click();
            }}
            onDrop={(evt) =>
              onDrop(evt, definitionVersion, dispatch, setErrors, setImported)
            }
            onDragOver={(evt) => {
              evt.dataTransfer.effectAllowed = 'copyMove';
              evt.dataTransfer.dropEffect = 'copy';
              evt.preventDefault();
              evt.stopPropagation();
            }}
          >
            <FontAwesomeIcon icon={faUpload} />
          </UploadIcon>
        )}
      </SinglePaneFlexCell>
      <Grid style={{overflow: 'hidden'}}>
        <MenuCell style={{pointerEvents: 'all'}}>
          <MenuContainer>
            <Row $selected={true}>
              <IconContainer>
                <FontAwesomeIcon icon={faBook} />
                <MenuTooltip>{t('Add Definition')}</MenuTooltip>
              </IconContainer>
            </Row>
          </MenuContainer>
        </MenuCell>
        <SpanOverflowCell>
          <Container>
            <ControlRow>
              <Label>{t('Load Draft Definition')}</Label>
              <Detail>
                <AccentUploadButton
                  multiple
                  inputRef={uploadButton}
                  onLoad={(files) => {
                    importDefinitions(
                      Array.from(files),
                      definitionVersion,
                      dispatch,
                      setErrors,
                      setImported,
                    );
                  }}
                >
                  {t('Load')}
                </AccentUploadButton>
              </Detail>
            </ControlRow>
            <ControlRow>
              <Label>{t('Definition version')}</Label>
              <Detail style={{fontSize: 12, color: 'var(--color_label)'}}>
                {t('Auto-detected')} · {definitionVersion.toUpperCase()}
              </Detail>
            </ControlRow>
            {definition && (
              <>
                <ControlRow>
                  <Label>{t('Shown Keyboard Definition')}</Label>
                  <Detail>
                    <AccentSelect
                      onChange={(option: any) => {
                        // Reset selected layouts when choosing a different
                        // definition
                        dispatch(updateSelectedOptionKeys([]));

                        if (option) {
                          dispatch(
                            updateSelectedDefinitionIndex(+option.value),
                          );
                        }
                      }}
                      value={options[selectedDefinitionIndex]}
                      options={options}
                    />
                  </Detail>
                </ControlRow>
              </>
            )}
            {definition && (
              <Layouts
                definition={definition}
                onLayoutChange={(newSelectedOptionKeys) => {
                  dispatch(updateSelectedOptionKeys(newSelectedOptionKeys));
                }}
              />
            )}
            {definition && (
              <ControlRow>
                <Label>{t('Show Matrix')}</Label>
                <Detail>
                  <AccentSlider
                    isChecked={showMatrix}
                    onChange={(val) => {
                      dispatch(updateShowMatrix(val));
                    }}
                  />
                </Detail>
              </ControlRow>
            )}
            {errors.map((error: string) => (
              <IndentedControlRow key={error}>
                <DesignErrorMessage>{error}</DesignErrorMessage>
              </IndentedControlRow>
            ))}
            {imported && (
              <IndentedControlRow>
                <DesignInfoMessage>{imported}</DesignInfoMessage>
              </IndentedControlRow>
            )}
            <ControlRow>
              <Label>{t('Draft Definitions')}</Label>
              <Detail>
                {Object.values(versionDefinitions).length} {t('Definitions')}
              </Detail>
            </ControlRow>
            {versionDefinitions.map((definition) => {
              return (
                <IndentedControlRow
                  key={`${definitionVersion}-${definition[definitionVersion].vendorProductId}`}
                >
                  <SubLabel>
                    {resolveDefinitionName(definition[definitionVersion].name)}
                  </SubLabel>
                  <Detail>
                    {formatNumberAsHex(
                      definition[definitionVersion].vendorProductId,
                      8,
                    )}
                    <IconButtonUnfilledContainer
                      onClick={() => {
                        dispatch(
                          unloadCustomDefinition({
                            id: definition[definitionVersion].vendorProductId,
                            version: definitionVersion,
                          }),
                        );
                      }}
                      style={{marginLeft: 10, borderRadius: 4}}
                    >
                      <FontAwesomeIcon icon={faXmark} size={'lg'} />
                    </IconButtonUnfilledContainer>
                  </Detail>
                </IndentedControlRow>
              );
            })}
          </Container>
        </SpanOverflowCell>
      </Grid>
    </DesignPane>
  );
};
