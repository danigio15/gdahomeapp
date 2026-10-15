#!/usr/bin/env ruby
# Aggiunge l'estensione delle notifiche al progetto Xcode dell'iPhone.
#
#   ruby strumenti/notifiche-in-xcode.rb
#
# Il target si chiama «NotificheService», i sorgenti stanno in
# `app/ios/NotificheService`, e l'estensione viaggia dentro l'app per iPhone
# (Runner.app/PlugIns). Apre la busta della notifica mentre arriva e mostra
# il testo vero al posto di «gdahome: nuova notifica» (docs/NOTIFICHE.md).
#
# Si fa con uno script, come l'orologio: il workflow lo lancia solo quando le
# notifiche ci sono (il segreto di Firebase). Ci vuole la gemma `xcodeproj`,
# che sui Mac di GitHub c'e' gia'. Si puo' lanciare due volte: la seconda non
# fa niente.
require 'xcodeproj'

QUI = File.expand_path('../app/ios', __dir__)
NOME = 'NotificheService'
TELEFONO = 'com.gdahome.gdahome'
ESTENSIONE = "#{TELEFONO}.NotificheService"

progetto = Xcodeproj::Project.open(File.join(QUI, 'Runner.xcodeproj'))
runner = progetto.targets.find { |t| t.name == 'Runner' } or abort 'Runner non c\'e\''

if progetto.targets.any? { |t| t.name == NOME }
  puts "#{NOME} c'e' gia'."
  exit 0
end

estensione = progetto.new_target(:app_extension, NOME, :ios, '15.0', nil, :swift)
# Come per l'orologio: la gemma ci mette Foundation col percorso dell'SDK di
# questa macchina, e Swift la collega gia' da solo.
estensione.frameworks_build_phase.files.to_a.each do |f|
  ref = f.file_ref
  f.remove_from_project
  ref&.remove_from_project
end

gruppo = progetto.main_group.new_group(NOME, NOME)
impostazioni = gruppo.new_reference('NotificheService.xcconfig')
gruppo.new_reference('Info.plist')
Dir.glob(File.join(QUI, NOME, '*.swift')).sort.each do |file|
  estensione.source_build_phase.add_file_reference(gruppo.new_reference(File.basename(file)))
end

estensione.build_configurations.each do |c|
  c.base_configuration_reference = impostazioni
  s = c.build_settings
  s['PRODUCT_NAME'] = '$(TARGET_NAME)'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = ESTENSIONE
  s['INFOPLIST_FILE'] = "#{NOME}/Info.plist"
  s['GENERATE_INFOPLIST_FILE'] = 'NO'
  s['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  s['TARGETED_DEVICE_FAMILY'] = '1,2'
  s['SWIFT_VERSION'] = '5.0'
  s['SKIP_INSTALL'] = 'YES'
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['APPLICATION_EXTENSION_API_ONLY'] = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks', '@executable_path/../../Frameworks']
  # La versione la prende da NotificheService.xcconfig.
  s.delete('MARKETING_VERSION')
  s.delete('CURRENT_PROJECT_VERSION')
end

# Dentro l'app per iPhone, in `PlugIns/`, prima di «Thin Binary» di Flutter
# (come l'orologio: dopo, le due fasi si aspettano a vicenda).
runner.add_dependency(estensione)
dentro = runner.new_copy_files_build_phase('Embed App Extensions')
dentro.dst_subfolder_spec = '13'
file = dentro.add_file_reference(estensione.product_reference)
file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
sottile = runner.build_phases.find { |f| f.respond_to?(:name) && f.name == 'Thin Binary' }
if sottile
  runner.build_phases.delete(dentro)
  runner.build_phases.insert(runner.build_phases.index(sottile), dentro)
end

progetto.save
puts "Aggiunta #{NOME} (#{ESTENSIONE}), dentro Runner.app/PlugIns."
