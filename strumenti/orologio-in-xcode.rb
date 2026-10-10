#!/usr/bin/env ruby
# Aggiunge l'app per Apple Watch al progetto Xcode dell'iPhone.
#
#   ruby strumenti/orologio-in-xcode.rb
#
# Il target si chiama «gdahome Watch», i sorgenti stanno in `app/ios/Orologio`
# e l'orologio viaggia dentro l'app per iPhone (Runner.app/Watch), come vuole
# l'App Store. Si fa con uno script e non a mano nel progetto per la stessa
# ragione per cui CarPlay si accende con una variabile: finche' l'orologio non
# e' acceso (variabile GDAHOME_OROLOGIO = si, vedi docs/OROLOGIO.md) l'app per
# iPhone resta esattamente quella di prima, e un errore nell'orologio non
# ferma il telefono.
#
# Ci vuole la gemma `xcodeproj`, che sui Mac di GitHub c'e' gia' (viene con
# CocoaPods). Si puo' lanciare due volte: la seconda non fa niente.
require 'xcodeproj'

QUI = File.expand_path('../app/ios', __dir__)
NOME = 'gdahome Watch'
TELEFONO = 'com.gdahome.gdahome'
OROLOGIO = "#{TELEFONO}.watchkitapp"

progetto = Xcodeproj::Project.open(File.join(QUI, 'Runner.xcodeproj'))
runner = progetto.targets.find { |t| t.name == 'Runner' } or abort 'Runner non c\'e\''

if progetto.targets.any? { |t| t.name == NOME }
  puts "#{NOME} c'e' gia'."
  exit 0
end

orologio = progetto.new_target(:application, NOME, :watchos, '10.0', nil, :swift)
# La gemma ci mette Foundation col percorso dell'SDK di questa macchina
# (WatchOS26.0.sdk…): su un Xcode diverso non si troverebbe, e Swift la
# collega gia' da solo.
orologio.frameworks_build_phase.files.to_a.each do |f|
  ref = f.file_ref
  f.remove_from_project
  ref&.remove_from_project
end
progetto.main_group.children.select { |g| g.display_name == 'Frameworks' && g.respond_to?(:recursive_children) && g.recursive_children.none? { |c| c.is_a?(Xcodeproj::Project::Object::PBXFileReference) } }.each(&:remove_from_project)

gruppo = progetto.main_group.new_group('Orologio', 'Orologio')
impostazioni = gruppo.new_reference('Orologio.xcconfig')
Dir.glob(File.join(QUI, 'Orologio', '*.swift')).sort.each do |file|
  orologio.source_build_phase.add_file_reference(gruppo.new_reference(File.basename(file)))
end
orologio.resources_build_phase.add_file_reference(gruppo.new_reference('Assets.xcassets'))

orologio.build_configurations.each do |c|
  c.base_configuration_reference = impostazioni
  s = c.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = OROLOGIO
  s['GENERATE_INFOPLIST_FILE'] = 'YES'
  s['INFOPLIST_KEY_CFBundleDisplayName'] = 'gdahome'
  # E' l'orologio dell'app per iPhone, e senza iPhone non sa niente: le chiavi
  # di casa stanno li'.
  s['INFOPLIST_KEY_WKCompanionAppBundleIdentifier'] = TELEFONO
  s['INFOPLIST_KEY_WKRunsIndependentlyOfCompanionApp'] = 'NO'
  s['INFOPLIST_KEY_UISupportedInterfaceOrientations'] = 'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown'
  s['ASSETCATALOG_COMPILER_APPICON_NAME'] = 'AppIcon'
  s['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  s['SDKROOT'] = 'watchos'
  # Il progetto di Flutter dice SUPPORTED_PLATFORMS = iphoneos per tutti, e
  # l'orologio lo ereditava: nell'archivio dell'iPhone si compilava per
  # l'iPhone, e `import WatchKit` non si trovava. Il suo e' watchOS.
  s['SUPPORTED_PLATFORMS'] = 'watchos watchsimulator'
  s['WATCHOS_DEPLOYMENT_TARGET'] = '10.0'
  s['TARGETED_DEVICE_FAMILY'] = '4'
  s['SWIFT_VERSION'] = '5.0'
  s['SKIP_INSTALL'] = 'YES'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['ENABLE_PREVIEWS'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks']
  # La versione la prende da Orologio.xcconfig: niente numeri scritti qui.
  s.delete('MARKETING_VERSION')
  s.delete('CURRENT_PROJECT_VERSION')
end

# L'orologio viaggia dentro l'app per iPhone, in `Watch/`.
runner.add_dependency(orologio)
dentro = runner.new_copy_files_build_phase('Embed Watch Content')
dentro.dst_subfolder_spec = '16'
dentro.dst_path = '$(CONTENTS_FOLDER_PATH)/Watch'
file = dentro.add_file_reference(orologio.product_reference)
file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
# Prima di «Thin Binary» di Flutter: in fondo, la copia dell'orologio e quella
# fase si aspettavano a vicenda («Cycle inside Runner»), e l'archivio cadeva.
# E' la stessa cosa che si fa a mano con le estensioni in un'app Flutter.
sottile = runner.build_phases.find { |f| f.respond_to?(:name) && f.name == 'Thin Binary' }
if sottile
  runner.build_phases.delete(dentro)
  runner.build_phases.insert(runner.build_phases.index(sottile), dentro)
end

progetto.save
puts "Aggiunto #{NOME} (#{OROLOGIO}), dentro Runner.app/Watch."
